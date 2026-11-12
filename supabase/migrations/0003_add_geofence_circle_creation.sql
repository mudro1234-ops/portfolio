create or replace function public.create_geofence_circle(
  target_organization uuid,
  fence_name text,
  center_latitude double precision,
  center_longitude double precision,
  radius_metres integer
) returns uuid
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  created_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.has_org_role(target_organization, array['owner','admin','fleet_manager']::public.organization_role[]) then
    raise exception 'Insufficient permission to create geofences';
  end if;
  if length(trim(fence_name)) < 2 or length(trim(fence_name)) > 100 then raise exception 'Invalid geofence name'; end if;
  if center_latitude < -90 or center_latitude > 90 or center_longitude < -180 or center_longitude > 180 then raise exception 'Invalid coordinates'; end if;
  if radius_metres < 20 or radius_metres > 50000 then raise exception 'Radius must be between 20 and 50000 metres'; end if;
  insert into public.geofences(organization_id,name,area)
  values (
    target_organization,
    trim(fence_name),
    extensions.ST_Buffer(
      extensions.ST_SetSRID(extensions.ST_MakePoint(center_longitude,center_latitude),4326)::extensions.geography,
      radius_metres
    )::extensions.geography
  )
  returning id into created_id;
  return created_id;
end;
$$;
revoke all on function public.create_geofence_circle(uuid,text,double precision,double precision,integer) from public;
grant execute on function public.create_geofence_circle(uuid,text,double precision,double precision,integer) to authenticated;