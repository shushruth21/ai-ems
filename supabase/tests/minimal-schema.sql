-- The subset of the Prisma schema that the RLS migrations reference.
-- CI's `database` job additionally runs the policies against the full schema
-- created by `prisma db push`.
create table public.organizations (id text primary key, name text);
create table public.profiles (id uuid primary key, email text, full_name text, created_at timestamptz, updated_at timestamptz);
create table public.roles (id text primary key, organization_id text);
create table public.permissions (key text primary key);
create table public.role_permissions (role_id text, permission_key text);
create table public.memberships (id text primary key, organization_id text, profile_id uuid, role_id text, status text);
create table public.leads (id text primary key, organization_id text, title text);
create table public.notifications (id text primary key, organization_id text, recipient_id uuid);
create table public.api_keys (id text primary key, organization_id text);
create table public.invitations (id text primary key, organization_id text);
create table public.outbox_events (id bigint primary key, organization_id text);
create table public.stock_movements (id bigint primary key, organization_id text);
create table public.audit_events (id bigint primary key, organization_id text);
create table public.sales_orders (id text primary key, organization_id text);
create table public.work_orders (id text primary key, organization_id text);
create table public.work_order_operations (id text primary key, organization_id text);
create table public.tasks (id text primary key, organization_id text);
