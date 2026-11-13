-- Workspace applications: approval-gated company and individual workspaces.
-- This migration is additive; it does not delete or rewrite existing tenant data.

alter table public.organizations
  add column if not exists workspace_type text not null default 'company'
    check (workspace_type in ('company', 'individual')),
  add column if not exists contact_email text,
  add column if not exists contact_phone text,
  add column if not exists country_code char(2) not null default 'ZW',
  add column if not exists currency_code char(3) not null default 'USD';

create table if not exists public.system_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  granted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.system_admins enable row level security;

create or replace function public.is_system_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select exists (
    select 1
    from public.system_admins sa
    where sa.user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_system_admin() from public;
revoke all on function public.is_system_admin() from anon;
grant execute on function public.is_system_admin() to authenticated;

drop policy if exists "system admins read own membership" on public.system_admins;
create policy "system admins read own membership"
  on public.system_admins for select to authenticated
  using (user_id = (select auth.uid()) or public.is_system_admin());

create table if not exists public.workspace_applications (
  id uuid primary key default gen_random_uuid(),
  applicant_user_id uuid not null references auth.users(id) on delete cascade,
  workspace_type text not null check (workspace_type in ('company', 'individual')),
  workspace_name text not null check (length(trim(workspace_name)) between 2 and 120),
  contact_email text not null,
  contact_phone text,
  country_code char(2) not null default 'ZW',
  currency_code char(3) not null default 'USD',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  review_note text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  organization_id uuid references public.organizations(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workspace_application_review_state check (
    (status = 'pending' and reviewed_by is null and reviewed_at is null and organization_id is null)
    or
    (status = 'approved' and reviewed_by is not null and reviewed_at is not null and organization_id is not null)
    or
    (status = 'rejected' and reviewed_by is not null and reviewed_at is not null and organization_id is null)
  )
);

create unique index if not exists workspace_applications_one_pending_per_user_idx
  on public.workspace_applications(applicant_user_id)
  where status = 'pending';
create index if not exists workspace_applications_status_created_idx
  on public.workspace_applications(status, created_at desc);
create index if not exists workspace_applications_org_idx
  on public.workspace_applications(organization_id)
  where organization_id is not null;

alter table public.workspace_applications enable row level security;

drop policy if exists "applicants read own applications" on public.workspace_applications;
create policy "applicants read own applications"
  on public.workspace_applications for select to authenticated
  using (applicant_user_id = (select auth.uid()));

drop policy if exists "system admins read all applications" on public.workspace_applications;
create policy "system admins read all applications"
  on public.workspace_applications for select to authenticated
  using (public.is_system_admin());

drop policy if exists "applicants submit pending applications" on public.workspace_applications;
create policy "applicants submit pending applications"
  on public.workspace_applications for insert to authenticated
  with check (
    applicant_user_id = (select auth.uid())
    and status = 'pending'
    and reviewed_by is null
    and reviewed_at is null
    and review_note is null
    and organization_id is null
  );

drop policy if exists "system admins update applications" on public.workspace_applications;
create policy "system admins update applications"
  on public.workspace_applications for update to authenticated
  using (public.is_system_admin())
  with check (public.is_system_admin());

create or replace function public.review_workspace_application(
  p_application_id uuid,
  p_decision text,
  p_review_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_application public.workspace_applications%rowtype;
  v_org_id uuid;
  v_slug_base text;
  v_slug text;
begin
  if (select auth.uid()) is null or not public.is_system_admin() then
    raise exception 'system_admin_required' using errcode = '42501';
  end if;

  if p_decision not in ('approve', 'reject') then
    raise exception 'invalid_decision' using errcode = '22023';
  end if;

  if p_review_note is not null and length(p_review_note) > 1000 then
    raise exception 'review_note_too_long' using errcode = '22023';
  end if;

  select *
    into v_application
    from public.workspace_applications
   where id = p_application_id
   for update;

  if not found then
    raise exception 'application_not_found' using errcode = 'P0002';
  end if;

  if v_application.status <> 'pending' then
    raise exception 'application_already_reviewed' using errcode = '55000';
  end if;

  if p_decision = 'approve' then
    v_slug_base := trim(both '-' from regexp_replace(lower(v_application.workspace_name), '[^a-z0-9]+', '-', 'g'));
    if length(v_slug_base) < 2 then
      v_slug_base := 'workspace';
    end if;
    v_slug := left(v_slug_base, 42) || '-' || left(replace(gen_random_uuid()::text, '-', ''), 8);

    insert into public.organizations (
      name, slug, created_by, workspace_type, contact_email, contact_phone, country_code, currency_code
    ) values (
      v_application.workspace_name,
      v_slug,
      v_application.applicant_user_id,
      v_application.workspace_type,
      v_application.contact_email,
      v_application.contact_phone,
      v_application.country_code,
      v_application.currency_code
    ) returning id into v_org_id;

    insert into public.organization_memberships (organization_id, user_id, role)
    values (v_org_id, v_application.applicant_user_id, 'owner');

    insert into public.subscription_accounts (organization_id)
    values (v_org_id);

    update public.workspace_applications
       set status = 'approved',
           review_note = nullif(trim(coalesce(p_review_note, '')), ''),
           reviewed_by = (select auth.uid()),
           reviewed_at = now(),
           organization_id = v_org_id,
           updated_at = now()
     where id = p_application_id;

    insert into public.audit_logs (organization_id, actor_user_id, action, resource_type, resource_id, metadata)
    values (v_org_id, (select auth.uid()), 'workspace_application_approved',
            'workspace_application', p_application_id::text,
            jsonb_build_object('workspace_type', v_application.workspace_type));
    return v_org_id;
  end if;

  update public.workspace_applications
     set status = 'rejected',
         review_note = nullif(trim(coalesce(p_review_note, '')), ''),
         reviewed_by = (select auth.uid()),
         reviewed_at = now(),
         updated_at = now()
   where id = p_application_id;

  insert into public.audit_logs (organization_id, actor_user_id, action, resource_type, resource_id, metadata)
  values (null, (select auth.uid()), 'workspace_application_rejected',
          'workspace_application', p_application_id::text, '{}'::jsonb);
  return null;
end;
$$;

revoke all on function public.review_workspace_application(uuid, text, text) from public;
revoke all on function public.review_workspace_application(uuid, text, text) from anon;
grant execute on function public.review_workspace_application(uuid, text, text) to authenticated;

comment on table public.workspace_applications is
  'Approval-gated requests for company or individual owner workspaces. Applicants can submit and read only their own requests.';
comment on table public.system_admins is
  'Platform-level administrators. Bootstrap the first row manually after verifying the intended account.';


-- Explicit Data API privileges: Supabase no longer auto-exposes newly created public tables.
grant select on table public.system_admins to authenticated;
grant select, insert, update on table public.workspace_applications to authenticated;
