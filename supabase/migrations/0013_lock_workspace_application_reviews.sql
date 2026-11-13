-- Applications are reviewed only through the guarded SECURITY DEFINER RPC.
-- Remove direct UPDATE access so a browser client cannot bypass the review workflow.
drop policy if exists "system admins update applications" on public.workspace_applications;
revoke update on table public.workspace_applications from authenticated;
