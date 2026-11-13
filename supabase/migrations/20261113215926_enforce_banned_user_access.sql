-- Enforce user-level suspension even for access tokens issued before the ban.
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
    join auth.users u on u.id = m.user_id
    where m.organization_id = target_org
      and m.user_id = (select auth.uid())
      and o.account_status = 'active'
      and (u.banned_until is null or u.banned_until <= now())
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
    join auth.users u on u.id = m.user_id
    where m.organization_id = target_org
      and m.user_id = (select auth.uid())
      and m.role = any(allowed)
      and o.account_status = 'active'
      and (u.banned_until is null or u.banned_until <= now())
  );
$$;

revoke all on function public.is_org_member(uuid) from public;
revoke all on function public.has_org_role(uuid, public.organization_role[]) from public;
grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.has_org_role(uuid, public.organization_role[]) to authenticated;
