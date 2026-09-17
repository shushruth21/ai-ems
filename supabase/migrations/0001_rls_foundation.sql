-- AI EMS — Row Level Security foundation (defense in depth).
-- Apply AFTER `prisma migrate deploy` has created the tables.
-- Server code uses Prisma (privileged role) with an explicit tenant scope;
-- these policies protect every path that uses the Supabase anon/authenticated
-- roles directly: Realtime, Storage, PostgREST.

-- 1. Helper: organizations the current user is an ACTIVE member of.
create schema if not exists app;

create or replace function app.current_org_ids()
returns setof text
language sql
stable
security definer
set search_path = ''
as $$
  select m.organization_id
  from public.memberships m
  where m.profile_id = (select auth.uid())
    and m.status = 'ACTIVE'
$$;

revoke all on function app.current_org_ids() from public;
grant usage on schema app to authenticated;
grant execute on function app.current_org_ids() to authenticated;

-- 2. Permission check helper for write policies and RPCs.
create or replace function app.has_permission(org_id text, perm text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships m
    join public.role_permissions rp on rp.role_id = m.role_id
    where m.profile_id = (select auth.uid())
      and m.organization_id = org_id
      and m.status = 'ACTIVE'
      and rp.permission_key = perm
  )
$$;

grant execute on function app.has_permission(text, text) to authenticated;

-- 3. Enable RLS + tenant read policy on every table that has organization_id.
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
    execute format('alter table public.%I enable row level security', t.table_name);
    execute format('alter table public.%I force row level security', t.table_name);
    execute format('drop policy if exists tenant_read on public.%I', t.table_name);
    execute format(
      'create policy tenant_read on public.%I for select to authenticated
         using (organization_id in (select app.current_org_ids()))',
      t.table_name
    );
    -- No insert/update/delete policies: direct client writes are denied.
    -- All writes go through server actions (Prisma) with authorization.
  end loop;
end $$;

-- 4. Non-tenant tables.
alter table public.organizations enable row level security;
drop policy if exists org_read on public.organizations;
create policy org_read on public.organizations for select to authenticated
  using (id in (select app.current_org_ids()));

alter table public.profiles enable row level security;
drop policy if exists profile_self on public.profiles;
create policy profile_self on public.profiles for select to authenticated
  using (
    id = (select auth.uid())
    or id in (
      select m.profile_id from public.memberships m
      where m.organization_id in (select app.current_org_ids())
    )
  );

alter table public.permissions enable row level security;
drop policy if exists permissions_read on public.permissions;
create policy permissions_read on public.permissions for select to authenticated using (true);

alter table public.role_permissions enable row level security;
drop policy if exists role_permissions_read on public.role_permissions;
create policy role_permissions_read on public.role_permissions for select to authenticated
  using (role_id in (select r.id from public.roles r where r.organization_id in (select app.current_org_ids())));

-- 5. Sensitive tables: members only see their own notifications; API key hashes are never readable.
drop policy if exists tenant_read on public.notifications;
drop policy if exists own_notifications on public.notifications;
create policy own_notifications on public.notifications for select to authenticated
  using (recipient_id = (select auth.uid()));

drop policy if exists tenant_read on public.api_keys;
drop policy if exists tenant_read on public.invitations;
drop policy if exists tenant_read on public.outbox_events;

-- 6. Keep profiles in sync with auth.users.
create or replace function app.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, created_at, updated_at)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name', now(), now())
  on conflict (id) do update set email = excluded.email, updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert or update of email on auth.users
  for each row execute function app.handle_new_user();

-- 7. Immutable ledgers.
create or replace function app.forbid_mutation()
returns trigger language plpgsql as $$
begin
  raise exception '% is append-only', tg_table_name;
end;
$$;

drop trigger if exists stock_movements_immutable on public.stock_movements;
create trigger stock_movements_immutable before update or delete on public.stock_movements
  for each row execute function app.forbid_mutation();

drop trigger if exists audit_events_immutable on public.audit_events;
create trigger audit_events_immutable before update or delete on public.audit_events
  for each row execute function app.forbid_mutation();

-- 8. Realtime: publish only tables the UI subscribes to (for cache invalidation).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table
      public.notifications, public.sales_orders, public.work_orders,
      public.work_order_operations, public.leads, public.tasks;
  end if;
exception when duplicate_object then null;
end $$;
