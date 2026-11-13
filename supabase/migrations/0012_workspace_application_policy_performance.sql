-- Keep the applicant/admin SELECT rule in one policy and index reviewer foreign keys.
drop policy if exists "applicants read own applications" on public.workspace_applications;
drop policy if exists "system admins read all applications" on public.workspace_applications;
create policy "applicants and admins read applications"
  on public.workspace_applications for select to authenticated
  using (
    applicant_user_id = (select auth.uid())
    or exists (
      select 1 from public.system_admins sa
      where sa.user_id = (select auth.uid())
    )
  );

create index if not exists system_admins_granted_by_idx
  on public.system_admins(granted_by);
create index if not exists workspace_applications_reviewed_by_idx
  on public.workspace_applications(reviewed_by);
