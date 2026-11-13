-- VEKTOR platform administration: lifecycle, support, and platform settings.
alter table public.organizations
  add column if not exists account_status text not null default 'active'
    check (account_status in ('active','suspended','archived')),
  add column if not exists status_reason text,
  add column if not exists status_changed_at timestamptz,
  add column if not exists status_changed_by uuid references auth.users(id) on delete set null;

create table if not exists public.support_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete set null,
  requester_user_id uuid references auth.users(id) on delete set null,
  subject text not null check (length(trim(subject)) between 3 and 180),
  description text not null check (length(trim(description)) between 5 and 10000),
  status text not null default 'open' check (status in ('open','in_progress','waiting','resolved','closed')),
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  assigned_to uuid references auth.users(id) on delete set null,
  internal_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.platform_settings (
  key text primary key check (key ~ '^[a-z][a-z0-9_.-]{1,100}$'),
  value jsonb not null default '{}'::jsonb,
  description text,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.support_requests enable row level security;
alter table public.platform_settings enable row level security;

drop policy if exists "system admins manage support requests" on public.support_requests;
create policy "system admins manage support requests"
on public.support_requests for all to authenticated
using (exists (select 1 from public.system_admins sa where sa.user_id = (select auth.uid())))
with check (exists (select 1 from public.system_admins sa where sa.user_id = (select auth.uid())));

drop policy if exists "system admins manage platform settings" on public.platform_settings;
create policy "system admins manage platform settings"
on public.platform_settings for all to authenticated
using (exists (select 1 from public.system_admins sa where sa.user_id = (select auth.uid())))
with check (exists (select 1 from public.system_admins sa where sa.user_id = (select auth.uid())));

-- Audit history is append-only. Administrative writes are performed by trusted server routes.
drop policy if exists "audit logs immutable no update" on public.audit_logs;
create policy "audit logs immutable no update"
on public.audit_logs for update to authenticated using (false) with check (false);
drop policy if exists "audit logs immutable no delete" on public.audit_logs;
create policy "audit logs immutable no delete"
on public.audit_logs for delete to authenticated using (false);

create index if not exists organizations_account_status_idx on public.organizations(account_status);
create index if not exists support_requests_status_created_idx on public.support_requests(status, created_at desc);
create index if not exists audit_logs_created_at_idx on public.audit_logs(created_at desc);
