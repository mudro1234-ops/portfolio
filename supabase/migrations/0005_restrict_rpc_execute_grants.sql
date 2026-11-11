revoke all on function public.create_organization_with_owner(text,text) from public,anon;
grant execute on function public.create_organization_with_owner(text,text) to authenticated;
revoke all on function public.has_org_role(uuid,public.organization_role[]) from public,anon;
grant execute on function public.has_org_role(uuid,public.organization_role[]) to authenticated;
revoke all on function public.is_org_member(uuid) from public,anon;
grant execute on function public.is_org_member(uuid) to authenticated;
revoke all on function public.guard_membership_role_changes() from public,anon,authenticated;