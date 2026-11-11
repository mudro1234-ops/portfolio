create or replace function public.guard_membership_role_changes()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  actor_is_owner boolean;
  actor_is_admin boolean;
  organization_creator uuid;
  has_members boolean;
begin
  -- Permit only the creator's first owner row during initial workspace setup.
  -- The organizations table has no client INSERT policy, and this check is
  -- tied to auth.uid(), so it cannot be used to grant ownership in another tenant.
  if TG_OP = 'INSERT' and new.role = 'owner' then
    select o.created_by into organization_creator
    from public.organizations o
    where o.id = new.organization_id;

    select exists (
      select 1 from public.organization_memberships m
      where m.organization_id = new.organization_id
    ) into has_members;

    if organization_creator = auth.uid() and not has_members then
      return new;
    end if;
  end if;

  actor_is_owner := public.has_org_role(
    coalesce(new.organization_id, old.organization_id),
    array['owner']::public.organization_role[]
  );
  actor_is_admin := public.has_org_role(
    coalesce(new.organization_id, old.organization_id),
    array['admin']::public.organization_role[]
  );

  if actor_is_owner then
    if TG_OP = 'DELETE' then return old; else return new; end if;
  end if;

  if not actor_is_admin then
    raise exception 'Only organization owners or admins may manage memberships';
  end if;

  if TG_OP = 'DELETE' then
    if old.role = 'owner' then
      raise exception 'Only an owner may remove an owner';
    end if;
    return old;
  end if;

  if new.role = 'owner' or (TG_OP = 'UPDATE' and old.role = 'owner') then
    raise exception 'Only an owner may grant or change owner membership';
  end if;

  return new;
end;
$$;