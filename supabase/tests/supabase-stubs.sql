-- Minimal stand-ins for the objects Supabase provides (auth, storage, roles),
-- so the RLS migrations can be tested against plain PostgreSQL in CI.
create schema if not exists auth;
create schema if not exists storage;
do $$ begin
  create role authenticated;
exception when duplicate_object then null;
end $$;
create table if not exists auth.users (id uuid primary key, email text, raw_user_meta_data jsonb);
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
create table if not exists storage.buckets (
  id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]
);
create table if not exists storage.objects (id uuid default gen_random_uuid(), bucket_id text, name text);
alter table storage.objects enable row level security;
create or replace function storage.foldername(name text) returns text[] language sql as $$
  select string_to_array(name, '/')
$$;
grant usage on schema auth, storage to authenticated;
