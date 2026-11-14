-- Let signed-in workspace members submit and track their own support requests.
drop policy if exists "workspace members submit support requests" on public.support_requests;
create policy "workspace members submit support requests"
on public.support_requests for insert to authenticated
with check (
  requester_user_id = (select auth.uid())
  and organization_id is not null
  and private.is_org_member(organization_id)
);

drop policy if exists "requesters read own support requests" on public.support_requests;
create policy "requesters read own support requests"
on public.support_requests for select to authenticated
using (
  requester_user_id = (select auth.uid())
  and organization_id is not null
  and private.is_org_member(organization_id)
);
