-- Keep RLS helper functions outside PostgREST's exposed public schema.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create or replace function private.is_org_member(target_org uuid)
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

create or replace function private.has_org_role(target_org uuid, allowed public.organization_role[])
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

revoke all on function private.is_org_member(uuid) from public;
revoke all on function private.has_org_role(uuid, public.organization_role[]) from public;
grant execute on function private.is_org_member(uuid) to authenticated;
grant execute on function private.has_org_role(uuid, public.organization_role[]) to authenticated;

do $$
declare
  p record;
  new_qual text;
  new_check text;
  statement text;
begin
  for p in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (
        coalesce(qual, '') like '%is_org_member(%'
        or coalesce(qual, '') like '%has_org_role(%'
        or coalesce(with_check, '') like '%is_org_member(%'
        or coalesce(with_check, '') like '%has_org_role(%'
      )
  loop
    new_qual := replace(replace(p.qual, 'is_org_member(', 'private.is_org_member('), 'has_org_role(', 'private.has_org_role(');
    new_check := replace(replace(p.with_check, 'is_org_member(', 'private.is_org_member('), 'has_org_role(', 'private.has_org_role(');
    statement := format('alter policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
    if p.qual is not null then statement := statement || format(' using (%s)', new_qual); end if;
    if p.with_check is not null then statement := statement || format(' with check (%s)', new_check); end if;
    execute statement;
  end loop;
end;
$$;

revoke all on function public.is_org_member(uuid) from public, anon, authenticated;
revoke all on function public.has_org_role(uuid, public.organization_role[]) from public, anon, authenticated;
