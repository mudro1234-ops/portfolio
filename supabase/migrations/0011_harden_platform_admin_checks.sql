-- Keep the platform-admin check table-based in RLS and inside the
-- privileged review function. This avoids exposing a separate SECURITY DEFINER
-- boolean helper through the Data API.

drop policy if exists "system admins read own membership" on public.system_admins;
create policy "system admins read own membership"
  on public.system_admins for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "system admins read all applications" on public.workspace_applications;
create policy "system admins read all applications"
  on public.workspace_applications for select to authenticated
  using (
    exists (
      select 1 from public.system_admins sa
      where sa.user_id = (select auth.uid())
    )
  );

drop policy if exists "system admins update applications" on public.workspace_applications;
create policy "system admins update applications"
  on public.workspace_applications for update to authenticated
  using (
    exists (
      select 1 from public.system_admins sa
      where sa.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.system_admins sa
      where sa.user_id = (select auth.uid())
    )
  );

drop function if exists public.is_system_admin();

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
  if (select auth.uid()) is null or not exists (
    select 1 from public.system_admins sa
    where sa.user_id = (select auth.uid())
  ) then
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
    if length(v_slug_base) < 2 then v_slug_base := 'workspace'; end if;
    v_slug := left(v_slug_base, 42) || '-' || left(replace(gen_random_uuid()::text, '-', ''), 8);

    insert into public.organizations (
      name, slug, created_by, workspace_type, contact_email, contact_phone, country_code, currency_code
    ) values (
      v_application.workspace_name, v_slug, v_application.applicant_user_id,
      v_application.workspace_type, v_application.contact_email, v_application.contact_phone,
      v_application.country_code, v_application.currency_code
    ) returning id into v_org_id;

    insert into public.organization_memberships (organization_id, user_id, role)
    values (v_org_id, v_application.applicant_user_id, 'owner');

    insert into public.subscription_accounts (organization_id) values (v_org_id);

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
