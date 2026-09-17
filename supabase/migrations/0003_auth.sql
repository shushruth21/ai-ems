-- AI EMS — Phase 3: authentication hardening.
-- Idempotent. Apply after `prisma migrate deploy` (needs auth_events,
-- rate_limit_buckets) and after 0001/0002.

-- 1. MFA is enforced in the database too: once a user has a verified second
--    factor, tenant data is only visible to sessions that completed it (aal2).
create or replace function app.mfa_satisfied()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select auth.jwt()) ->> 'aal', 'aal1') = 'aal2'
      or not exists (
        select 1 from auth.mfa_factors f
        where f.user_id = (select auth.uid()) and f.status = 'verified'
      )
$$;

revoke all on function app.mfa_satisfied() from public;
grant execute on function app.mfa_satisfied() to authenticated;

do $$
declare
  t record;
begin
  for t in
    select c.table_name
    from information_schema.columns c
    join information_schema.tables tb
      on tb.table_schema = c.table_schema and tb.table_name = c.table_name
    where c.table_schema = 'public'
      and c.column_name = 'organization_id'
      and tb.table_type = 'BASE TABLE'
  loop
    execute format('drop policy if exists require_mfa on public.%I', t.table_name);
    execute format(
      'create policy require_mfa on public.%I as restrictive for select to authenticated
         using ((select app.mfa_satisfied()))',
      t.table_name
    );
  end loop;
end $$;

drop policy if exists require_mfa on public.organizations;
create policy require_mfa on public.organizations as restrictive for select to authenticated
  using ((select app.mfa_satisfied()));

drop policy if exists require_mfa on storage.objects;
create policy require_mfa on storage.objects as restrictive for select to authenticated
  using ((select app.mfa_satisfied()));

-- 2. Security activity: users can read their own events; nobody writes directly.
alter table public.auth_events enable row level security;
alter table public.auth_events force row level security;
drop policy if exists own_auth_events on public.auth_events;
create policy own_auth_events on public.auth_events for select to authenticated
  using (profile_id = (select auth.uid()));

-- Append-only, except for retention purges (see docs/governance/retention-policy.md).
drop trigger if exists auth_events_no_update on public.auth_events;
create trigger auth_events_no_update before update on public.auth_events
  for each row execute function app.forbid_mutation();

-- 3. Rate-limit counters are server-only.
alter table public.rate_limit_buckets enable row level security;
alter table public.rate_limit_buckets force row level security;
revoke all on public.rate_limit_buckets from authenticated;
do $$ begin
  execute 'revoke all on public.rate_limit_buckets from anon';
exception when undefined_object then null;
end $$;

-- 4. Housekeeping, callable from a scheduled job (pg_cron or the worker).
create or replace function app.purge_auth_data(auth_event_days int default 365)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.rate_limit_buckets where expires_at < (now() at time zone 'utc') - interval '1 hour';
  delete from public.auth_events where created_at < (now() at time zone 'utc') - make_interval(days => auth_event_days);
$$;

revoke all on function app.purge_auth_data(int) from public;
