-- Trip automation, geofence transitions and audit trail. Runs only inside the database.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
alter table public.trips add column if not exists last_position extensions.geography(point,4326), add column if not exists last_movement_at timestamptz, add column if not exists last_speed_kph real;
create table if not exists public.vehicle_geofence_state (organization_id uuid not null references public.organizations(id) on delete cascade,vehicle_id uuid not null,geofence_id uuid not null references public.geofences(id) on delete cascade,inside boolean not null default false,updated_at timestamptz not null default now(),primary key(vehicle_id,geofence_id),foreign key(vehicle_id,organization_id) references public.vehicles(id,organization_id) on delete cascade);
alter table public.vehicle_geofence_state enable row level security;
drop policy if exists "geofence state read" on public.vehicle_geofence_state;
create policy "geofence state read" on public.vehicle_geofence_state for select to authenticated using(public.is_org_member(organization_id));
create or replace function private.process_vehicle_position() returns trigger language plpgsql security definer set search_path=public,private,extensions as $$
declare active_trip public.trips%rowtype; assigned_driver uuid; previous_inside boolean; now_inside boolean; fence record; segment_metres double precision;
begin
 select va.driver_id into assigned_driver from public.vehicle_assignments va where va.organization_id=new.organization_id and va.vehicle_id=new.vehicle_id and va.starts_at<=new.device_time and (va.ends_at is null or va.ends_at>new.device_time) order by va.starts_at desc limit 1;
 select * into active_trip from public.trips where vehicle_id=new.vehicle_id and organization_id=new.organization_id and status='in_progress' order by started_at desc limit 1 for update;
 if not found then
  if coalesce(new.speed_kph,0)>=8 then
   insert into public.trips(organization_id,vehicle_id,driver_id,started_at,start_position,last_position,last_movement_at,last_speed_kph,distance_km,status) values(new.organization_id,new.vehicle_id,assigned_driver,new.device_time,new.position,new.position,new.device_time,new.speed_kph,0,'in_progress');
  end if;
 else
  segment_metres:=case when active_trip.last_position is not null and new.device_time>coalesce(active_trip.last_movement_at,active_trip.started_at) and coalesce(new.speed_kph,0)>=3 then extensions.ST_Distance(active_trip.last_position,new.position) else 0 end;
  update public.trips set distance_km=coalesce(distance_km,0)+case when segment_metres between 0 and 2000 then segment_metres/1000 else 0 end,last_position=new.position,last_speed_kph=new.speed_kph,last_movement_at=case when coalesce(new.speed_kph,0)>=3 then new.device_time else last_movement_at end,ended_at=case when coalesce(new.speed_kph,0)<3 and last_movement_at is not null and new.device_time-last_movement_at>=interval '10 minutes' then new.device_time else ended_at end,end_position=case when coalesce(new.speed_kph,0)<3 and last_movement_at is not null and new.device_time-last_movement_at>=interval '10 minutes' then new.position else end_position end,status=case when coalesce(new.speed_kph,0)<3 and last_movement_at is not null and new.device_time-last_movement_at>=interval '10 minutes' then 'completed' else status end where id=active_trip.id;
 end if;
 for fence in select id,name,area from public.geofences where organization_id=new.organization_id and enabled=true loop
  now_inside:=extensions.ST_Covers(fence.area::extensions.geometry,new.position::extensions.geometry);
  select inside into previous_inside from public.vehicle_geofence_state where vehicle_id=new.vehicle_id and geofence_id=fence.id;
  if (previous_inside is null and now_inside) or (previous_inside is not null and previous_inside is distinct from now_inside) then
   insert into public.alerts(organization_id,vehicle_id,alert_type,severity,message,occurred_at) values(new.organization_id,new.vehicle_id,case when now_inside then 'geofence_entry' else 'geofence_exit' end,'info',case when now_inside then 'Vehicle entered geofence: '||fence.name else 'Vehicle exited geofence: '||fence.name end,new.device_time);
  end if;
  insert into public.vehicle_geofence_state(organization_id,vehicle_id,geofence_id,inside,updated_at) values(new.organization_id,new.vehicle_id,fence.id,now_inside,now()) on conflict(vehicle_id,geofence_id) do update set inside=excluded.inside,updated_at=excluded.updated_at;
 end loop;
 return new;
end; $$;
revoke all on function private.process_vehicle_position() from public,anon,authenticated;
drop trigger if exists process_vehicle_position_after_insert on public.vehicle_positions;
create trigger process_vehicle_position_after_insert after insert on public.vehicle_positions for each row execute function private.process_vehicle_position();
alter function public.create_geofence_circle(uuid,text,double precision,double precision,integer) security invoker;
revoke all on function public.create_geofence_circle(uuid,text,double precision,double precision,integer) from public,anon;
grant execute on function public.create_geofence_circle(uuid,text,double precision,double precision,integer) to authenticated;
create or replace function private.audit_fleet_change() returns trigger language plpgsql security definer set search_path=public,private as $$
declare org uuid; rid text; begin org:=coalesce((to_jsonb(new)->>'organization_id')::uuid,(to_jsonb(old)->>'organization_id')::uuid);rid:=coalesce(to_jsonb(new)->>'id',to_jsonb(old)->>'id');insert into public.audit_logs(organization_id,actor_user_id,action,resource_type,resource_id,metadata) values(org,auth.uid(),lower(tg_op),tg_table_name,rid,jsonb_build_object('source','database_trigger'));return coalesce(new,old);end; $$;
revoke all on function private.audit_fleet_change() from public,anon,authenticated;
drop trigger if exists audit_vehicle_change on public.vehicles; create trigger audit_vehicle_change after insert or update or delete on public.vehicles for each row execute function private.audit_fleet_change();
drop trigger if exists audit_driver_change on public.drivers; create trigger audit_driver_change after insert or update or delete on public.drivers for each row execute function private.audit_fleet_change();
drop trigger if exists audit_assignment_change on public.vehicle_assignments; create trigger audit_assignment_change after insert or update or delete on public.vehicle_assignments for each row execute function private.audit_fleet_change();