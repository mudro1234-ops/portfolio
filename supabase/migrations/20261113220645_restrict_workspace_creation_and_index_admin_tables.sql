-- Workspace creation is approval-gated; prevent arbitrary authenticated users from bypassing the application flow.
revoke execute on function public.create_organization_with_owner(text, text) from public;
revoke execute on function public.create_organization_with_owner(text, text) from anon;
revoke execute on function public.create_organization_with_owner(text, text) from authenticated;

-- Cover the foreign keys added for platform administration tables.
create index if not exists organizations_status_changed_by_idx on public.organizations(status_changed_by);
create index if not exists platform_settings_updated_by_idx on public.platform_settings(updated_by);
create index if not exists support_requests_assigned_to_idx on public.support_requests(assigned_to);
create index if not exists support_requests_organization_id_idx on public.support_requests(organization_id);
create index if not exists support_requests_requester_user_id_idx on public.support_requests(requester_user_id);
