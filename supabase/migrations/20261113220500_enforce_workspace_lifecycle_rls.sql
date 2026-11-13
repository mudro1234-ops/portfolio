-- Suspended and archived workspaces must lose access immediately at the RLS boundary.
create or replace function public.is_org_member(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.organization_memberships m
    join public.organizations o on o.id = m.organization_id
    where m.organization_id = target_org
      and m.user_id = (select auth.uid())
      and o.account_status = 'active'
  );
$$;

create or replace function public.has_org_role(target_org uuid, allowed public.organization_role[])
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.organization_memberships m
    join public.organizations o on o.id = m.organization_id
    where m.organization_id = target_org
      and m.user_id = (select auth.uid())
      and m.role = any(allowed)
      and o.account_status = 'active'
  );
$$;

revoke all on function public.is_org_member(uuid) from public;
revoke all on function public.has_org_role(uuid, public.organization_role[]) from public;
grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.has_org_role(uuid, public.organization_role[]) to authenticated;

-- Driver-consent inserts must also respect workspace suspension.
drop policy if exists "driver records own consent" on public.tracking_consents;
create policy "driver records own consent"
on public.tracking_consents for insert to authenticated
with check (
  exists (
    select 1
    from public.drivers d
    join public.organizations o on o.id = d.organization_id
    where d.id = tracking_consents.driver_id
      and d.organization_id = tracking_consents.organization_id
      and d.user_id = (select auth.uid())
      and o.account_status = 'active'
  )
);
