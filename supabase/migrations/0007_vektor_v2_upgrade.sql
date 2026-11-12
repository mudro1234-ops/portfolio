-- !! DRAFT - assembled but not yet run against a real or test database. Do NOT apply to production until the upgrade test passes. !!
-- =====================================================================
-- VEKTOR migration 0007 - v2 upgrade of the Madrude/VEKTOR foundation
-- =====================================================================
-- Run this ONCE, after migrations 0001-0006 are applied. It upgrades the
-- existing tables in place (your data is kept) and adds everything the new
-- web dashboard, driver app and GPS ingestion need:
--   * stricter row-level security (drivers only see their own vehicle)
--   * invitations, notifications, plans, billing records, AI usage
--   * GPS ingestion functions, trips / geofence / alert automation
--   * subscription limits, audit trail, realtime, optional pg_cron
-- Tenant isolation: RLS on every table + composite (id, organization_id)
-- foreign keys so a row can never point at another company's data.
-- =====================================================================


-- =====================================================================
-- STEP 1 - clear the old access rules, triggers and helper functions.
-- They are rebuilt below in a stricter form. Without this step the old,
-- looser policies would stay active next to the new ones (policies are
-- OR-ed together by Postgres).
-- =====================================================================
do $$
declare r record;
begin
  for r in select schemaname, tablename, policyname from pg_policies where schemaname = 'public' loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

drop trigger if exists guard_membership_role_changes on public.organization_memberships;
drop trigger if exists process_vehicle_position_after_insert on public.vehicle_positions;
drop trigger if exists audit_vehicle_change on public.vehicles;
drop trigger if exists audit_driver_change on public.drivers;
drop trigger if exists audit_assignment_change on public.vehicle_assignments;

drop function if exists public.guard_membership_role_changes();
drop function if exists private.process_vehicle_position();
drop function if exists private.audit_fleet_change();
drop function if exists public.create_geofence_circle(uuid, text, double precision, double precision, integer);
drop function if exists public.create_organization_with_owner(text, text);
drop function if exists public.has_org_role(uuid, public.organization_role[]);
drop function if exists public.is_org_member(uuid);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- =====================================================================
-- STEP 2 - bring the existing tables up to the new shape (data is kept)
-- =====================================================================

-- ---- user_profiles -------------------------------------------------
alter table public.user_profiles rename column user_id to id;
alter table public.user_profiles
  add column if not exists email text,
  add column if not exists avatar_url text,
  add column if not exists is_platform_admin boolean not null default false;
update public.user_profiles p set email = u.email from auth.users u where u.id = p.id and p.email is null;
insert into public.user_profiles (id, email, full_name)
  select u.id, u.email, split_part(u.email, '@', 1) from auth.users u
  on conflict (id) do nothing;
drop trigger if exists user_profiles_updated_at on public.user_profiles;
create trigger user_profiles_updated_at before update on public.user_profiles
  for each row execute function public.set_updated_at();

-- ---- organizations -------------------------------------------------
alter table public.organizations
  add column if not exists contact_email text,
  add column if not exists contact_phone text,
  add column if not exists country text not null default 'ZW',
  add column if not exists timezone text not null default 'Africa/Harare',
  add column if not exists currency text not null default 'USD',
  add column if not exists status text not null default 'active',
  add column if not exists trip_start_speed_kmh numeric not null default 8,
  add column if not exists trip_end_speed_kmh numeric not null default 3,
  add column if not exists trip_end_minutes integer not null default 10,
  add column if not exists stale_after_seconds integer not null default 300,
  add column if not exists offline_after_seconds integer not null default 900,
  add column if not exists position_retention_days integer not null default 180;
alter table public.organizations
  add constraint organizations_status_chk check (status in ('active', 'suspended')),
  add constraint organizations_thresholds_chk check (
    trip_start_speed_kmh > 0 and trip_end_speed_kmh >= 0 and trip_end_speed_kmh < trip_start_speed_kmh
    and trip_end_minutes > 0 and stale_after_seconds > 0 and offline_after_seconds > stale_after_seconds
    and position_retention_days >= 7);
drop trigger if exists organizations_updated_at on public.organizations;
create trigger organizations_updated_at before update on public.organizations
  for each row execute function public.set_updated_at();

-- ---- organization_memberships --------------------------------------
alter table public.organization_memberships
  add column if not exists status text not null default 'active',
  add column if not exists updated_at timestamptz not null default now();
alter table public.organization_memberships
  add constraint memberships_status_chk check (status in ('active', 'suspended', 'removed'));
drop trigger if exists memberships_updated_at on public.organization_memberships;
create trigger memberships_updated_at before update on public.organization_memberships
  for each row execute function public.set_updated_at();

-- ---- subscription_accounts -----------------------------------------
alter table public.subscription_accounts rename column plan_code to plan;
alter table public.subscription_accounts alter column status drop default;
alter table public.subscription_accounts alter column status type text using (
  case status::text when 'canceled' then 'cancelled' when 'incomplete' then 'past_due' else status::text end);
alter table public.subscription_accounts alter column status set default 'trialing';
alter table public.subscription_accounts
  add column if not exists vehicle_limit integer,
  add column if not exists user_limit integer;
alter table public.subscription_accounts
  add constraint subscription_status_chk check (status in ('trialing', 'active', 'past_due', 'cancelled'));
-- Trial workspaces get the trial allowance. Other plans stay unlimited until a platform admin sets limits.
update public.subscription_accounts set vehicle_limit = 5, user_limit = 10
 where plan = 'trial' and vehicle_limit is null;
drop type if exists public.subscription_status;

-- ---- vehicles ------------------------------------------------------
alter table public.vehicles
  add column if not exists category text not null default 'light_vehicle',
  add column if not exists colour text,
  add column if not exists vin text,
  add column if not exists fuel_type text not null default 'diesel',
  add column if not exists odometer_km numeric,
  add column if not exists speed_limit_kmh numeric,
  add column if not exists insurance_expiry date,
  add column if not exists licence_expiry date,
  add column if not exists registered_at date not null default current_date;
alter table public.vehicles
  add constraint vehicles_fuel_type_chk check (fuel_type in ('diesel', 'petrol', 'electric', 'hybrid', 'lpg', 'other')),
  add constraint vehicles_odometer_chk check (odometer_km is null or odometer_km >= 0),
  add constraint vehicles_speed_limit_chk check (speed_limit_kmh is null or speed_limit_kmh > 0);
drop trigger if exists vehicles_updated_at on public.vehicles;
create trigger vehicles_updated_at before update on public.vehicles
  for each row execute function public.set_updated_at();

-- ---- drivers -------------------------------------------------------
alter table public.drivers
  add column if not exists email text,
  add column if not exists emergency_contact text,
  add column if not exists updated_at timestamptz not null default now();
create index if not exists drivers_org_idx on public.drivers (organization_id);
create index if not exists drivers_user_idx on public.drivers (user_id);
drop trigger if exists drivers_updated_at on public.drivers;
create trigger drivers_updated_at before update on public.drivers
  for each row execute function public.set_updated_at();

-- ---- gps_devices ---------------------------------------------------
alter table public.gps_devices rename column unique_id to imei;
alter table public.gps_devices rename column last_seen_at to last_communication_at;
alter table public.gps_devices rename column network_operator to sim_operator;
alter table public.gps_devices
  add column if not exists status text not null default 'active',
  add column if not exists updated_at timestamptz not null default now();
update public.gps_devices set status = case when active then 'active' else 'inactive' end;
alter table public.gps_devices drop column active;
alter table public.gps_devices add constraint gps_devices_status_chk check (status in ('active', 'inactive'));
-- A tracker belongs to exactly one organisation (ingest looks devices up by IMEI).
create unique index gps_devices_imei_key on public.gps_devices (imei);
create index if not exists gps_devices_vehicle_idx on public.gps_devices (vehicle_id);
drop trigger if exists gps_devices_updated_at on public.gps_devices;
create trigger gps_devices_updated_at before update on public.gps_devices
  for each row execute function public.set_updated_at();
-- Removing a vehicle must not delete the tracker from inventory.
do $$
declare c record;
begin
  for c in select conname from pg_constraint
            where conrelid = 'public.gps_devices'::regclass and contype = 'f'
              and confrelid = 'public.vehicles'::regclass loop
    execute format('alter table public.gps_devices drop constraint %I', c.conname);
  end loop;
end $$;
alter table public.gps_devices
  add constraint gps_devices_vehicle_fk foreign key (vehicle_id, organization_id)
  references public.vehicles (id, organization_id) on delete set null (vehicle_id);

-- ---- vehicle_assignments -------------------------------------------
alter table public.vehicle_assignments rename column starts_at to assigned_at;
alter table public.vehicle_assignments rename column ends_at to unassigned_at;
alter table public.vehicle_assignments
  add column if not exists assigned_by uuid references auth.users (id) on delete set null;
-- keep only the newest open assignment per vehicle and per driver
update public.vehicle_assignments a
   set unassigned_at = greatest(now(), a.assigned_at + interval '1 millisecond')
 where a.unassigned_at is null and exists (
   select 1 from public.vehicle_assignments b
    where b.unassigned_at is null and b.vehicle_id = a.vehicle_id and b.id <> a.id
      and (b.assigned_at > a.assigned_at or (b.assigned_at = a.assigned_at and b.id > a.id)));
update public.vehicle_assignments a
   set unassigned_at = greatest(now(), a.assigned_at + interval '1 millisecond')
 where a.unassigned_at is null and exists (
   select 1 from public.vehicle_assignments b
    where b.unassigned_at is null and b.driver_id = a.driver_id and b.id <> a.id
      and (b.assigned_at > a.assigned_at or (b.assigned_at = a.assigned_at and b.id > a.id)));
create unique index vehicle_assignments_one_active_vehicle
  on public.vehicle_assignments (vehicle_id) where unassigned_at is null;
create unique index vehicle_assignments_one_active_driver
  on public.vehicle_assignments (driver_id) where unassigned_at is null;
create index if not exists vehicle_assignments_org_idx on public.vehicle_assignments (organization_id);

-- ---- tracking_consents ---------------------------------------------
alter table public.tracking_consents
  add column if not exists user_id uuid references auth.users (id) on delete cascade;
update public.tracking_consents c set user_id = d.user_id
  from public.drivers d where d.id = c.driver_id and c.user_id is null;
update public.tracking_consents set granted_at = coalesce(granted_at, recorded_at) where granted_at is null;
update public.tracking_consents set withdrawn_at = coalesce(withdrawn_at, recorded_at)
 where status = 'withdrawn' and withdrawn_at is null;
alter table public.tracking_consents alter column granted_at set default now();
alter table public.tracking_consents alter column granted_at set not null;
alter table public.tracking_consents alter column status set default 'granted';
alter table public.tracking_consents alter column purpose set default 'Share the assigned vehicle location during work.';
alter table public.tracking_consents alter column policy_version set default 'v1';
create index if not exists tracking_consents_driver_idx on public.tracking_consents (driver_id, granted_at desc);

-- ---- vehicle_positions ---------------------------------------------
alter table public.vehicle_positions rename column gps_device_id to device_id;
alter table public.vehicle_positions rename column position to geom;
alter table public.vehicle_positions rename column speed_kph to speed_kmh;
alter table public.vehicle_positions rename column heading_deg to heading;
alter table public.vehicle_positions
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists driver_id uuid,
  add column if not exists ignition boolean;
update public.vehicle_positions
   set latitude = st_y(geom::geometry), longitude = st_x(geom::geometry)
 where latitude is null;
alter table public.vehicle_positions alter column latitude set not null;
alter table public.vehicle_positions alter column longitude set not null;
alter table public.vehicle_positions alter column source type text using (
  case source::text when 'traccar' then 'hardware' else 'smartphone' end);
alter table public.vehicle_positions add constraint vehicle_positions_source_chk check (source in ('hardware', 'smartphone'));
delete from public.vehicle_positions p using public.vehicle_positions q
 where p.vehicle_id = q.vehicle_id and p.device_time = q.device_time and p.source = q.source and p.id > q.id;
create unique index vehicle_positions_dedupe on public.vehicle_positions (vehicle_id, device_time, source);
create index if not exists vehicle_positions_vehicle_time on public.vehicle_positions (vehicle_id, device_time desc);
create index if not exists vehicle_positions_org_received on public.vehicle_positions (organization_id, received_at desc);
-- deleting a tracker keeps its history
do $$
declare c record;
begin
  for c in select conname from pg_constraint
            where conrelid = 'public.vehicle_positions'::regclass and contype = 'f'
              and confrelid = 'public.gps_devices'::regclass loop
    execute format('alter table public.vehicle_positions drop constraint %I', c.conname);
  end loop;
end $$;
alter table public.vehicle_positions
  add constraint vehicle_positions_device_fk foreign key (device_id, organization_id)
  references public.gps_devices (id, organization_id) on delete set null (device_id);

-- ---- vehicle_current_state -----------------------------------------
alter table public.vehicle_current_state rename column position to geom;
alter table public.vehicle_current_state rename column speed_kph to speed_kmh;
alter table public.vehicle_current_state rename column heading_deg to heading;
alter table public.vehicle_current_state
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists ignition boolean,
  add column if not exists motion_state text not null default 'stopped',
  add column if not exists stopped_since timestamptz,
  add column if not exists active_trip_id uuid;
update public.vehicle_current_state
   set latitude = st_y(geom::geometry), longitude = st_x(geom::geometry)
 where geom is not null and latitude is null;
alter table public.vehicle_current_state alter column source type text using (
  case source::text when 'traccar' then 'hardware' when 'mobile' then 'smartphone' else null end);
alter table public.vehicle_current_state
  add constraint vehicle_current_state_motion_chk check (motion_state in ('moving', 'idle', 'stopped'));
-- "stale" is now worked out from the age of the last fix, never stored.
alter table public.vehicle_current_state drop column is_stale;
alter table public.vehicle_current_state drop column updated_at;
create index if not exists vehicle_current_state_org_idx on public.vehicle_current_state (organization_id);

-- ---- trips ---------------------------------------------------------
alter table public.trips
  add column if not exists start_latitude double precision,
  add column if not exists start_longitude double precision,
  add column if not exists end_latitude double precision,
  add column if not exists end_longitude double precision,
  add column if not exists origin text,
  add column if not exists destination text,
  add column if not exists source text not null default 'auto',
  add column if not exists notes text,
  add column if not exists created_by uuid references auth.users (id) on delete set null,
  add column if not exists updated_at timestamptz not null default now();
update public.trips set
  start_latitude = st_y(start_position::geometry), start_longitude = st_x(start_position::geometry)
 where start_position is not null;
update public.trips set
  end_latitude = st_y(end_position::geometry), end_longitude = st_x(end_position::geometry)
 where end_position is not null;
alter table public.trips drop column start_position, drop column end_position,
  drop column last_position, drop column last_movement_at, drop column last_speed_kph;
alter table public.trips alter column started_at drop not null;
do $$
declare c record;
begin
  for c in select conname from pg_constraint
            where conrelid = 'public.trips'::regclass and contype = 'c'
              and pg_get_constraintdef(oid) like '%status%' loop
    execute format('alter table public.trips drop constraint %I', c.conname);
  end loop;
end $$;
update public.trips set status = 'completed' where status = 'review';
alter table public.trips add constraint trips_status_chk check (status in ('planned', 'in_progress', 'completed', 'cancelled'));
alter table public.trips add constraint trips_source_chk check (source in ('auto', 'manual'));
update public.trips set distance_km = 0 where distance_km is null;
alter table public.trips alter column distance_km type numeric;
alter table public.trips alter column distance_km set default 0;
alter table public.trips alter column distance_km set not null;
-- only one open trip per vehicle: close older duplicates
update public.trips t set status = 'completed', ended_at = greatest(coalesce(t.ended_at, now()), t.started_at)
 where t.status = 'in_progress' and exists (
   select 1 from public.trips n
    where n.vehicle_id = t.vehicle_id and n.status = 'in_progress' and n.id <> t.id
      and (n.started_at > t.started_at or (n.started_at = t.started_at and n.id > t.id)));
create unique index trips_one_open_per_vehicle on public.trips (vehicle_id) where status = 'in_progress';
create index if not exists trips_org_started on public.trips (organization_id, started_at desc);
create index if not exists trips_vehicle_started on public.trips (vehicle_id, started_at desc);
-- deleting a driver keeps their trip history
do $$
declare c record;
begin
  for c in select conname from pg_constraint
            where conrelid = 'public.trips'::regclass and contype = 'f'
              and confrelid = 'public.drivers'::regclass loop
    execute format('alter table public.trips drop constraint %I', c.conname);
  end loop;
end $$;
alter table public.trips
  add constraint trips_driver_fk foreign key (driver_id, organization_id)
  references public.drivers (id, organization_id) on delete set null (driver_id);
drop trigger if exists trips_updated_at on public.trips;
create trigger trips_updated_at before update on public.trips
  for each row execute function public.set_updated_at();

-- ---- geofences -----------------------------------------------------
alter table public.geofences rename column enabled to is_active;
alter table public.geofences rename column area to boundary;
alter table public.geofences
  add column if not exists category text not null default 'other',
  add column if not exists shape text,
  add column if not exists center_latitude double precision,
  add column if not exists center_longitude double precision,
  add column if not exists radius_m double precision,
  add column if not exists polygon_coords jsonb,
  add column if not exists center geography(point, 4326),
  add column if not exists alert_on_entry boolean not null default true,
  add column if not exists alert_on_exit boolean not null default true,
  add column if not exists created_by uuid references auth.users (id) on delete set null,
  add column if not exists updated_at timestamptz not null default now();
-- circles made by the old helper are stored as their outline, so they are kept as polygons
update public.geofences set shape = 'polygon' where shape is null;
update public.geofences
   set polygon_coords = ((st_asgeojson(boundary::geometry)::jsonb) -> 'coordinates') -> 0
 where polygon_coords is null;
alter table public.geofences alter column shape set not null;
alter table public.geofences
  add constraint geofences_category_chk check (category in ('depot', 'customer', 'warehouse', 'site', 'restricted', 'other')),
  add constraint geofences_shape_chk check (shape in ('circle', 'polygon')),
  add constraint geofences_radius_chk check (radius_m is null or radius_m > 0),
  add constraint geofences_id_org_key unique (id, organization_id);
create index if not exists geofences_org_idx on public.geofences (organization_id);
drop trigger if exists geofences_updated_at on public.geofences;
create trigger geofences_updated_at before update on public.geofences
  for each row execute function public.set_updated_at();

-- ---- vehicle_geofence_state ----------------------------------------
alter table public.vehicle_geofence_state rename column updated_at to changed_at;
alter table public.vehicle_geofence_state
  add constraint vehicle_geofence_state_fence_org_fk foreign key (geofence_id, organization_id)
  references public.geofences (id, organization_id) on delete cascade;

-- ---- alerts --------------------------------------------------------
alter table public.alerts rename column alert_type to type;
alter table public.alerts rename column message to title;
alter table public.alerts rename column occurred_at to created_at;
alter table public.alerts
  add column if not exists driver_id uuid,
  add column if not exists description text,
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists status text not null default 'open',
  add column if not exists resolved_at timestamptz,
  add column if not exists resolution_notes text;
update public.alerts set status = 'acknowledged' where acknowledged_at is not null;
update public.alerts set type = 'other' where type not in (
  'geofence_entry', 'geofence_exit', 'device_offline', 'overspeed', 'maintenance_due',
  'unusual_movement', 'restricted_area', 'power_disconnected', 'other');
alter table public.alerts
  add constraint alerts_type_chk check (type in (
    'geofence_entry', 'geofence_exit', 'device_offline', 'overspeed', 'maintenance_due',
    'unusual_movement', 'restricted_area', 'power_disconnected', 'other')),
  add constraint alerts_status_chk check (status in ('open', 'acknowledged', 'resolved'));
-- deleting a vehicle removes its alerts instead of being blocked
do $$
declare c record;
begin
  for c in select conname from pg_constraint
            where conrelid = 'public.alerts'::regclass and contype = 'f'
              and confrelid = 'public.vehicles'::regclass loop
    execute format('alter table public.alerts drop constraint %I', c.conname);
  end loop;
end $$;
alter table public.alerts
  add constraint alerts_vehicle_fk foreign key (vehicle_id, organization_id)
  references public.vehicles (id, organization_id) on delete cascade;
create index if not exists alerts_org_status_idx on public.alerts (organization_id, status, created_at desc);
create index if not exists alerts_vehicle_type_idx on public.alerts (vehicle_id, type, status);

-- ---- maintenance_records -------------------------------------------
alter table public.maintenance_records rename column title to maintenance_type;
alter table public.maintenance_records rename column details to description;
alter table public.maintenance_records
  add column if not exists service_date date,
  add column if not exists next_service_date date,
  add column if not exists next_service_odometer_km numeric,
  add column if not exists provider text,
  add column if not exists status text not null default 'scheduled',
  add column if not exists created_by uuid references auth.users (id) on delete set null,
  add column if not exists updated_at timestamptz not null default now();
update public.maintenance_records
   set service_date = coalesce(completed_at, scheduled_at, created_at)::date,
       status = case when completed_at is not null then 'completed' else 'scheduled' end;
alter table public.maintenance_records alter column service_date set not null;
alter table public.maintenance_records drop column scheduled_at, drop column completed_at;
alter table public.maintenance_records alter column currency type text;
alter table public.maintenance_records
  add constraint maintenance_status_chk check (status in ('scheduled', 'in_progress', 'completed', 'cancelled'));
create index if not exists maintenance_org_date_idx on public.maintenance_records (organization_id, service_date desc);
create index if not exists maintenance_vehicle_idx on public.maintenance_records (vehicle_id);
drop trigger if exists maintenance_updated_at on public.maintenance_records;
create trigger maintenance_updated_at before update on public.maintenance_records
  for each row execute function public.set_updated_at();

-- ---- fuel_records --------------------------------------------------
alter table public.fuel_records rename column quantity_litres to litres;
alter table public.fuel_records
  add column if not exists fueled_at date,
  add column if not exists driver_id uuid,
  add column if not exists station text,
  add column if not exists receipt_path text,
  add column if not exists created_by uuid references auth.users (id) on delete set null;
update public.fuel_records set fueled_at = filled_at::date where fueled_at is null;
alter table public.fuel_records alter column fueled_at set not null;
alter table public.fuel_records alter column fueled_at set default current_date;
alter table public.fuel_records drop column filled_at;
alter table public.fuel_records alter column currency type text;
alter table public.fuel_records
  add constraint fuel_driver_fk foreign key (driver_id, organization_id)
  references public.drivers (id, organization_id) on delete set null (driver_id);
create index if not exists fuel_org_date_idx on public.fuel_records (organization_id, fueled_at desc);
create index if not exists fuel_vehicle_date_idx on public.fuel_records (vehicle_id, fueled_at desc);

-- ---- audit_logs ----------------------------------------------------
alter table public.audit_logs rename column actor_user_id to actor_id;
alter table public.audit_logs rename column resource_type to entity;
alter table public.audit_logs rename column resource_id to entity_id;
alter table public.audit_logs rename column metadata to details;
alter table public.audit_logs alter column details drop not null;
alter table public.audit_logs alter column details drop default;
create index if not exists audit_logs_org_created_idx on public.audit_logs (organization_id, created_at desc);

-- the old enums are no longer used by any column
drop type if exists public.gps_source;

-- =====================================================================
-- STEP 3 - new tables
-- =====================================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.user_profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


create table public.organization_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  email text not null,
  role public.organization_role not null check (role <> 'owner'),
  token uuid not null unique default gen_random_uuid(),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked', 'expired')),
  invited_by uuid references auth.users (id) on delete set null,
  expires_at timestamptz not null default now() + interval '7 days',
  created_at timestamptz not null default now()
);
create index on public.organization_invitations (organization_id);
create index on public.organization_invitations (lower(email));
create table public.geofence_events (
  id bigint generated always as identity primary key,
  organization_id uuid not null,
  vehicle_id uuid not null,
  geofence_id uuid not null,
  event text not null check (event in ('entry', 'exit')),
  occurred_at timestamptz not null,
  latitude double precision,
  longitude double precision,
  foreign key (vehicle_id, organization_id) references public.vehicles (id, organization_id) on delete cascade,
  foreign key (geofence_id, organization_id) references public.geofences (id, organization_id) on delete cascade
);
create index on public.geofence_events (organization_id, occurred_at desc);
create index on public.geofence_events (geofence_id, occurred_at desc);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.notifications (user_id, created_at desc);

-- =====================================================================
-- STEP 4 - access helpers, audit, limits, RPCs and row-level security
-- =====================================================================
-- ---------------------------------------------------------------------
-- Access helpers (security definer so policies never recurse)
-- ---------------------------------------------------------------------
create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_platform_admin from public.user_profiles where id = auth.uid()), false)
$$;

create or replace function public.org_role_of(p_org uuid)
returns public.organization_role language sql stable security definer set search_path = public as $$
  select m.role
  from public.organization_memberships m
  join public.organizations o on o.id = m.organization_id
  where m.organization_id = p_org
    and m.user_id = auth.uid()
    and m.status = 'active'
    and o.status = 'active'
$$;

create or replace function public.has_org_role(p_org uuid, p_roles public.organization_role[])
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.org_role_of(p_org) = any (p_roles), false)
$$;

create or replace function public.is_org_member(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.org_role_of(p_org) is not null
$$;

-- every role except driver
create or replace function public.is_staff(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_org_role(p_org, array['owner','admin','fleet_manager','dispatcher','analyst']::public.organization_role[])
$$;

create or replace function public.can_manage_fleet(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_org_role(p_org, array['owner','admin','fleet_manager']::public.organization_role[])
$$;

create or replace function public.can_dispatch(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_org_role(p_org, array['owner','admin','fleet_manager','dispatcher']::public.organization_role[])
$$;

create or replace function public.is_org_admin(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_org_role(p_org, array['owner','admin']::public.organization_role[])
$$;

-- ---------------------------------------------------------------------
-- Audit trigger (important operations)
-- ---------------------------------------------------------------------
create or replace function public.audit_row()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_row jsonb;
  v_org uuid;
  v_details jsonb;
begin
  v_row := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  v_org := case when tg_table_name = 'organizations'
                then (v_row ->> 'id')::uuid
                else (v_row ->> 'organization_id')::uuid end;
  if tg_op = 'UPDATE' then
    select jsonb_object_agg(n.key, jsonb_build_object('from', to_jsonb(old) -> n.key, 'to', n.value))
      into v_details
    from jsonb_each(to_jsonb(new)) n
    where n.key <> 'updated_at' and (to_jsonb(old) -> n.key) is distinct from n.value;
    if v_details is null then
      return new; -- nothing meaningful changed
    end if;
  else
    v_details := v_row;
  end if;
  insert into public.audit_logs (organization_id, actor_id, action, entity, entity_id, details)
  values (v_org, auth.uid(), lower(tg_op), tg_table_name, v_row ->> 'id', v_details);
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array[
    'organizations', 'organization_memberships', 'organization_invitations',
    'vehicles', 'drivers', 'gps_devices', 'vehicle_assignments', 'geofences',
    'maintenance_records', 'fuel_records', 'subscription_accounts'
  ] loop
    execute format('create trigger audit_%1$s after insert or update or delete on public.%1$s
                    for each row execute function public.audit_row()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Subscription limits
-- ---------------------------------------------------------------------
create or replace function public.enforce_vehicle_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_sub public.subscription_accounts%rowtype;
  v_count integer;
begin
  select * into v_sub from public.subscription_accounts where organization_id = new.organization_id;
  if not found then return new; end if;
  if v_sub.status = 'cancelled' then
    raise exception 'subscription_cancelled' using hint = 'Reactivate the subscription to add vehicles.';
  end if;
  if v_sub.status = 'trialing' and v_sub.trial_ends_at is not null and v_sub.trial_ends_at < now() then
    raise exception 'trial_expired' using hint = 'The free trial has ended. Choose a plan to continue.';
  end if;
  if v_sub.vehicle_limit is not null then
    select count(*) into v_count from public.vehicles
     where organization_id = new.organization_id and status <> 'retired';
    if v_count >= v_sub.vehicle_limit then
      raise exception 'vehicle_limit_reached' using hint = format('Your plan allows %s vehicles.', v_sub.vehicle_limit);
    end if;
  end if;
  return new;
end $$;

create trigger vehicles_enforce_limit before insert on public.vehicles
  for each row execute function public.enforce_vehicle_limit();

-- ---------------------------------------------------------------------
-- Organisation & team RPCs
-- ---------------------------------------------------------------------
create or replace function public.create_organization(
  p_name text,
  p_contact_email text default null,
  p_contact_phone text default null,
  p_country text default 'ZW',
  p_currency text default 'USD'
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_slug text;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if length(trim(coalesce(p_name, ''))) < 2 then raise exception 'invalid_name'; end if;
  v_slug := trim(both '-' from regexp_replace(lower(trim(p_name)), '[^a-z0-9]+', '-', 'g'));
  if v_slug = '' then v_slug := 'org'; end if;
  v_slug := v_slug || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);

  insert into public.organizations (name, slug, contact_email, contact_phone, country, currency, created_by)
  values (trim(p_name), v_slug, p_contact_email, p_contact_phone, upper(coalesce(p_country, 'ZW')), upper(coalesce(p_currency, 'USD')), auth.uid())
  returning id into v_id;

  insert into public.organization_memberships (organization_id, user_id, role)
  values (v_id, auth.uid(), 'owner');

  insert into public.subscription_accounts (organization_id, plan, status, vehicle_limit, user_limit, trial_ends_at)
  values (v_id, 'trial', 'trialing', 5, 10, now() + interval '14 days');

  return v_id;
end $$;

create or replace function public.invite_member(p_org uuid, p_email text, p_role public.organization_role)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_actor public.organization_role := public.org_role_of(p_org);
  v_token uuid;
  v_email text := lower(trim(p_email));
begin
  if v_actor is null then raise exception 'forbidden'; end if;
  if p_role = 'owner' then raise exception 'cannot_invite_owner'; end if;
  if v_actor = 'owner' then
    null;
  elsif v_actor = 'admin' then
    if p_role = 'admin' then raise exception 'forbidden_role'; end if;
  elsif v_actor = 'fleet_manager' then
    if p_role <> 'driver' then raise exception 'forbidden_role'; end if;
  else
    raise exception 'forbidden';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'invalid_email'; end if;

  update public.organization_invitations set status = 'revoked'
   where organization_id = p_org and lower(email) = v_email and status = 'pending';

  insert into public.organization_invitations (organization_id, email, role, invited_by)
  values (p_org, v_email, p_role, auth.uid())
  returning token into v_token;
  return v_token;
end $$;

create or replace function public.revoke_invitation(p_invitation uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_org uuid;
begin
  select organization_id into v_org from public.organization_invitations where id = p_invitation;
  if v_org is null or not public.can_manage_fleet(v_org) then raise exception 'forbidden'; end if;
  update public.organization_invitations set status = 'revoked' where id = p_invitation and status = 'pending';
end $$;

create or replace function public.accept_invitation(p_token uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_inv public.organization_invitations%rowtype;
  v_email text;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select email into v_email from auth.users where id = auth.uid();
  select * into v_inv from public.organization_invitations where token = p_token for update;
  if not found or v_inv.status <> 'pending' then raise exception 'invitation_invalid'; end if;
  if v_inv.expires_at < now() then
    update public.organization_invitations set status = 'expired' where id = v_inv.id;
    raise exception 'invitation_expired';
  end if;
  if lower(v_email) <> lower(v_inv.email) then raise exception 'invitation_email_mismatch'; end if;

  insert into public.organization_memberships (organization_id, user_id, role, status)
  values (v_inv.organization_id, auth.uid(), v_inv.role, 'active')
  on conflict (organization_id, user_id)
  do update set role = excluded.role, status = 'active'
    where public.organization_memberships.role <> 'owner';

  update public.organization_invitations set status = 'accepted' where id = v_inv.id;

  if v_inv.role = 'driver' then
    update public.drivers set user_id = auth.uid()
     where organization_id = v_inv.organization_id and user_id is null and lower(email) = lower(v_email);
  end if;
  return v_inv.organization_id;
end $$;

create or replace function public.set_member_role_status(
  p_org uuid, p_user uuid, p_role public.organization_role default null, p_status text default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_actor public.organization_role := public.org_role_of(p_org);
  v_target public.organization_memberships%rowtype;
begin
  if v_actor is null then raise exception 'forbidden'; end if;
  select * into v_target from public.organization_memberships
   where organization_id = p_org and user_id = p_user;
  if not found then raise exception 'member_not_found'; end if;
  if v_target.role = 'owner' then raise exception 'cannot_modify_owner'; end if;
  if p_user = auth.uid() then raise exception 'cannot_modify_self'; end if;
  if p_role = 'owner' then raise exception 'use_transfer_ownership'; end if;
  if p_status is not null and p_status not in ('active', 'suspended', 'removed') then
    raise exception 'invalid_status';
  end if;

  if v_actor = 'owner' then
    null;
  elsif v_actor = 'admin' then
    if v_target.role = 'admin' or p_role = 'admin' then raise exception 'forbidden_role'; end if;
  elsif v_actor = 'fleet_manager' then
    if v_target.role <> 'driver' or (p_role is not null and p_role <> 'driver') then
      raise exception 'forbidden_role';
    end if;
  else
    raise exception 'forbidden';
  end if;

  update public.organization_memberships
     set role = coalesce(p_role, role), status = coalesce(p_status, status)
   where organization_id = p_org and user_id = p_user;
end $$;

create or replace function public.transfer_ownership(p_org uuid, p_new_owner uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.org_role_of(p_org) is distinct from 'owner' then raise exception 'forbidden'; end if;
  if not exists (select 1 from public.organization_memberships
                  where organization_id = p_org and user_id = p_new_owner and status = 'active') then
    raise exception 'member_not_found';
  end if;
  update public.organization_memberships set role = 'admin' where organization_id = p_org and user_id = auth.uid();
  update public.organization_memberships set role = 'owner' where organization_id = p_org and user_id = p_new_owner;
end $$;

-- ---------------------------------------------------------------------
-- Driver <-> vehicle assignment
-- ---------------------------------------------------------------------
create or replace function public.assign_driver(p_vehicle uuid, p_driver uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_org uuid;
  v_driver_org uuid;
  v_id uuid;
begin
  select organization_id into v_org from public.vehicles where id = p_vehicle;
  select organization_id into v_driver_org from public.drivers where id = p_driver;
  if v_org is null or v_org is distinct from v_driver_org then raise exception 'not_found'; end if;
  if not public.can_dispatch(v_org) then raise exception 'forbidden'; end if;
  if (select status from public.drivers where id = p_driver) <> 'active' then raise exception 'driver_not_active'; end if;
  if (select status from public.vehicles where id = p_vehicle) in ('retired', 'inactive') then
    raise exception 'vehicle_not_available';
  end if;

  update public.vehicle_assignments set unassigned_at = now()
   where unassigned_at is null and (vehicle_id = p_vehicle or driver_id = p_driver);

  insert into public.vehicle_assignments (organization_id, vehicle_id, driver_id, assigned_by)
  values (v_org, p_vehicle, p_driver, auth.uid())
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.unassign_vehicle(p_vehicle uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_org uuid;
begin
  select organization_id into v_org from public.vehicles where id = p_vehicle;
  if v_org is null or not public.can_dispatch(v_org) then raise exception 'forbidden'; end if;
  update public.vehicle_assignments set unassigned_at = now()
   where vehicle_id = p_vehicle and unassigned_at is null;
end $$;

-- ---------------------------------------------------------------------
-- Driver-side helpers used by RLS
-- ---------------------------------------------------------------------
create or replace function public.my_driver_id(p_org uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select d.id from public.drivers d
   where d.organization_id = p_org and d.user_id = auth.uid() and d.status = 'active'
     and public.is_org_member(p_org)
   limit 1
$$;

create or replace function public.can_see_vehicle(p_org uuid, p_vehicle uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when public.is_staff(p_org) then true
    when public.has_org_role(p_org, array['driver']::public.organization_role[]) then exists (
      select 1 from public.vehicle_assignments a
       where a.vehicle_id = p_vehicle and a.unassigned_at is null
         and a.driver_id = public.my_driver_id(p_org))
    else false end
$$;

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table public.user_profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.organization_invitations enable row level security;
alter table public.subscription_accounts enable row level security;
alter table public.vehicles enable row level security;
alter table public.drivers enable row level security;
alter table public.gps_devices enable row level security;
alter table public.vehicle_assignments enable row level security;
alter table public.tracking_consents enable row level security;
alter table public.vehicle_positions enable row level security;
alter table public.vehicle_current_state enable row level security;
alter table public.trips enable row level security;
alter table public.geofences enable row level security;
alter table public.vehicle_geofence_state enable row level security;
alter table public.geofence_events enable row level security;
alter table public.alerts enable row level security;
alter table public.maintenance_records enable row level security;
alter table public.fuel_records enable row level security;
alter table public.audit_logs enable row level security;
alter table public.notifications enable row level security;

-- user_profiles: self + people who share an organisation you can administer/see
create policy profiles_select on public.user_profiles for select to authenticated using (
  id = auth.uid()
  or exists (select 1 from public.organization_memberships m
              where m.user_id = user_profiles.id and public.is_staff(m.organization_id))
);
create policy profiles_update_own on public.user_profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- organizations
create policy orgs_select on public.organizations for select to authenticated using (
  public.is_org_member(id) or public.is_platform_admin()
);
create policy orgs_update on public.organizations for update to authenticated
  using (public.is_org_admin(id)) with check (public.is_org_admin(id));

-- memberships: own row always; staff see colleagues
create policy memberships_select on public.organization_memberships for select to authenticated using (
  user_id = auth.uid() or public.is_staff(organization_id)
);

-- invitations: managers only (writes go through RPCs)
create policy invitations_select on public.organization_invitations for select to authenticated using (
  public.can_manage_fleet(organization_id)
);

-- subscription: owner/admin read (platform admin too)
create policy subscription_select on public.subscription_accounts for select to authenticated using (
  public.is_org_admin(organization_id) or public.is_platform_admin()
);

-- vehicles
create policy vehicles_select on public.vehicles for select to authenticated using (
  public.can_see_vehicle(organization_id, id)
);
create policy vehicles_insert on public.vehicles for insert to authenticated
  with check (public.can_manage_fleet(organization_id));
create policy vehicles_update on public.vehicles for update to authenticated
  using (public.can_manage_fleet(organization_id)) with check (public.can_manage_fleet(organization_id));
create policy vehicles_delete on public.vehicles for delete to authenticated
  using (public.is_org_admin(organization_id));

-- drivers
create policy drivers_select on public.drivers for select to authenticated using (
  public.is_staff(organization_id) or (user_id = auth.uid() and public.is_org_member(organization_id))
);
create policy drivers_insert on public.drivers for insert to authenticated
  with check (public.can_manage_fleet(organization_id));
create policy drivers_update on public.drivers for update to authenticated
  using (public.can_manage_fleet(organization_id)) with check (public.can_manage_fleet(organization_id));
create policy drivers_delete on public.drivers for delete to authenticated
  using (public.is_org_admin(organization_id));

-- gps_devices
create policy devices_select on public.gps_devices for select to authenticated using (public.is_staff(organization_id));
create policy devices_insert on public.gps_devices for insert to authenticated
  with check (public.can_manage_fleet(organization_id));
create policy devices_update on public.gps_devices for update to authenticated
  using (public.can_manage_fleet(organization_id)) with check (public.can_manage_fleet(organization_id));
create policy devices_delete on public.gps_devices for delete to authenticated
  using (public.is_org_admin(organization_id));

-- assignments (writes through assign_driver / unassign_vehicle)
create policy assignments_select on public.vehicle_assignments for select to authenticated using (
  public.is_staff(organization_id)
  or driver_id = public.my_driver_id(organization_id)
);

-- consents: drivers see their own, managers see status
create policy consents_select on public.tracking_consents for select to authenticated using (
  user_id = auth.uid() or public.can_manage_fleet(organization_id)
);

-- telemetry: read-only for clients
create policy positions_select on public.vehicle_positions for select to authenticated using (
  public.can_see_vehicle(organization_id, vehicle_id)
);
create policy current_state_select on public.vehicle_current_state for select to authenticated using (
  public.can_see_vehicle(organization_id, vehicle_id)
);

-- trips
create policy trips_select on public.trips for select to authenticated using (
  public.is_staff(organization_id) or driver_id = public.my_driver_id(organization_id)
);
create policy trips_insert on public.trips for insert to authenticated
  with check (public.can_dispatch(organization_id));
create policy trips_update on public.trips for update to authenticated
  using (public.can_dispatch(organization_id)) with check (public.can_dispatch(organization_id));

-- geofences
create policy geofences_select on public.geofences for select to authenticated using (public.is_staff(organization_id));
create policy geofences_delete on public.geofences for delete to authenticated using (public.can_manage_fleet(organization_id));
create policy geofences_update on public.geofences for update to authenticated
  using (public.can_manage_fleet(organization_id)) with check (public.can_manage_fleet(organization_id));
create policy geofence_state_select on public.vehicle_geofence_state for select to authenticated using (public.is_staff(organization_id));
create policy geofence_events_select on public.geofence_events for select to authenticated using (public.is_staff(organization_id));

-- alerts: staff read; dispatch+ acknowledge/resolve
create policy alerts_select on public.alerts for select to authenticated using (public.is_staff(organization_id));
create policy alerts_update on public.alerts for update to authenticated
  using (public.can_dispatch(organization_id)) with check (public.can_dispatch(organization_id));

-- maintenance
create policy maintenance_select on public.maintenance_records for select to authenticated using (public.is_staff(organization_id));
create policy maintenance_insert on public.maintenance_records for insert to authenticated
  with check (public.can_manage_fleet(organization_id));
create policy maintenance_update on public.maintenance_records for update to authenticated
  using (public.can_manage_fleet(organization_id)) with check (public.can_manage_fleet(organization_id));
create policy maintenance_delete on public.maintenance_records for delete to authenticated
  using (public.can_manage_fleet(organization_id));

-- fuel
create policy fuel_select on public.fuel_records for select to authenticated using (public.is_staff(organization_id));
create policy fuel_insert on public.fuel_records for insert to authenticated
  with check (public.can_dispatch(organization_id));
create policy fuel_update on public.fuel_records for update to authenticated
  using (public.can_manage_fleet(organization_id)) with check (public.can_manage_fleet(organization_id));
create policy fuel_delete on public.fuel_records for delete to authenticated
  using (public.can_manage_fleet(organization_id));

-- audit: owner/admin only, never writable by clients
create policy audit_select on public.audit_logs for select to authenticated using (
  organization_id is not null and public.is_org_admin(organization_id)
);

-- notifications: own only
create policy notifications_select on public.notifications for select to authenticated using (user_id = auth.uid());
create policy notifications_update on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());


-- =====================================================================
-- VEKTOR Migration 0002: GPS ingestion, trip / geofence / alert automation
-- =====================================================================
-- Positions are written ONLY by the two ingest functions below:
--   ingest_hardware_position()  -> service role only (Traccar webhook)
--   ingest_phone_position()     -> signed-in drivers, consent required
-- Browser clients have no INSERT privilege on telemetry tables.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Small spatial helpers (kept in plpgsql so spatial calls stay isolated)
-- ---------------------------------------------------------------------
create or replace function public.app_point(p_lon double precision, p_lat double precision)
returns geography language plpgsql immutable set search_path = public, extensions as $$
begin
  return st_setsrid(st_makepoint(p_lon, p_lat), 4326)::geography;
end $$;

create or replace function public.app_distance_m(a geography, b geography)
returns double precision language plpgsql immutable set search_path = public, extensions as $$
begin
  return st_distance(a, b);
end $$;

create or replace function public.app_inside_geofence(g public.geofences, p geography)
returns boolean language plpgsql stable set search_path = public, extensions as $$
begin
  if g.shape = 'circle' then
    return st_dwithin(g.center, p, g.radius_m);
  end if;
  return st_covers(g.boundary, p);
end $$;

-- ---------------------------------------------------------------------
-- Alerts (also fan out in-app notifications to the right roles)
-- ---------------------------------------------------------------------
create or replace function public.create_alert(
  p_org uuid, p_vehicle uuid, p_driver uuid, p_type text, p_severity text,
  p_title text, p_description text, p_lat double precision, p_lon double precision,
  p_metadata jsonb default '{}'::jsonb
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  insert into public.alerts (organization_id, vehicle_id, driver_id, type, severity, title, description, latitude, longitude, metadata)
  values (p_org, p_vehicle, p_driver, p_type, p_severity, p_title, p_description, p_lat, p_lon, coalesce(p_metadata, '{}'::jsonb))
  returning id into v_id;

  if p_severity in ('warning', 'critical') then
    insert into public.notifications (organization_id, user_id, title, body, link)
    select p_org, m.user_id, p_title, p_description, '/alerts'
      from public.organization_memberships m
     where m.organization_id = p_org and m.status = 'active'
       and m.role in ('owner', 'admin', 'fleet_manager', 'dispatcher');
  end if;
  return v_id;
end $$;

revoke all on function public.create_alert(uuid, uuid, uuid, text, text, text, text, double precision, double precision, jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Position processing trigger: current state, trips, geofences, alerts
-- ---------------------------------------------------------------------
create or replace function public.process_position()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare
  v_org public.organizations%rowtype;
  v_state public.vehicle_current_state%rowtype;
  v_has_state boolean;
  v_speed double precision := coalesce(new.speed_kmh, 0);
  v_motion text;
  v_stopped_since timestamptz;
  v_step_km double precision := 0;
  v_gap_s double precision;
  v_trip public.trips%rowtype;
  v_trip_id uuid;
  v_reg text;
  v_limit numeric;
  v_gf public.geofences%rowtype;
  v_inside boolean;
  v_prev boolean;
  v_prev_found boolean;
begin
  select * into v_org from public.organizations where id = new.organization_id;
  select * into v_state from public.vehicle_current_state where vehicle_id = new.vehicle_id for update;
  v_has_state := found;

  -- Out-of-order / buffered older positions are kept as history only.
  if v_has_state and v_state.device_time is not null and new.device_time < v_state.device_time then
    return new;
  end if;

  -- Motion state
  if v_speed >= v_org.trip_start_speed_kmh then
    v_motion := 'moving';
  elsif v_speed < v_org.trip_end_speed_kmh then
    v_motion := case when new.ignition is true then 'idle' else 'stopped' end;
  else
    v_motion := coalesce(v_state.motion_state, 'stopped');
  end if;

  -- Time spent below the "stopped" speed
  if v_speed < v_org.trip_end_speed_kmh then
    v_stopped_since := coalesce(v_state.stopped_since, new.device_time);
  else
    v_stopped_since := null;
  end if;

  -- Distance step (ignore GPS jitter while stationary and impossible jumps)
  if v_has_state and v_state.geom is not null and v_speed >= v_org.trip_end_speed_kmh then
    v_gap_s := extract(epoch from (new.device_time - v_state.device_time));
    if v_gap_s > 0 then
      v_step_km := public.app_distance_m(v_state.geom, new.geom) / 1000.0;
      if v_step_km / (v_gap_s / 3600.0) > 250 then
        v_step_km := 0;
      end if;
    end if;
  end if;

  -- Trips
  select * into v_trip from public.trips
   where vehicle_id = new.vehicle_id and status = 'in_progress'
   order by started_at desc nulls last limit 1;

  if found then
    if v_stopped_since is not null
       and new.device_time - v_stopped_since >= make_interval(mins => v_org.trip_end_minutes) then
      update public.trips
         set status = 'completed', ended_at = v_stopped_since,
             end_latitude = new.latitude, end_longitude = new.longitude
       where id = v_trip.id;
      v_trip_id := null;
    else
      update public.trips set distance_km = distance_km + v_step_km where id = v_trip.id;
      v_trip_id := v_trip.id;
    end if;
  elsif v_speed >= v_org.trip_start_speed_kmh then
    insert into public.trips (organization_id, vehicle_id, driver_id, status, started_at,
                              start_latitude, start_longitude, source)
    values (new.organization_id, new.vehicle_id, new.driver_id, 'in_progress', new.device_time,
            new.latitude, new.longitude, 'auto')
    returning id into v_trip_id;
  end if;

  -- Current state
  insert into public.vehicle_current_state as s (
    vehicle_id, organization_id, geom, latitude, longitude, speed_kmh, heading, ignition,
    source, device_time, received_at, motion_state, stopped_since, active_trip_id)
  values (
    new.vehicle_id, new.organization_id, new.geom, new.latitude, new.longitude, new.speed_kmh,
    new.heading, new.ignition, new.source, new.device_time, new.received_at, v_motion,
    v_stopped_since, v_trip_id)
  on conflict (vehicle_id) do update set
    geom = excluded.geom, latitude = excluded.latitude, longitude = excluded.longitude,
    speed_kmh = excluded.speed_kmh, heading = excluded.heading, ignition = excluded.ignition,
    source = excluded.source, device_time = excluded.device_time, received_at = excluded.received_at,
    motion_state = excluded.motion_state, stopped_since = excluded.stopped_since,
    active_trip_id = excluded.active_trip_id;

  select registration_number, speed_limit_kmh into v_reg, v_limit
    from public.vehicles where id = new.vehicle_id;

  -- A reporting vehicle clears its "device offline" alerts
  update public.alerts
     set status = 'resolved', resolved_at = now(), resolution_notes = 'Device resumed reporting'
   where vehicle_id = new.vehicle_id and type = 'device_offline' and status <> 'resolved';

  -- Overspeed (at most one alert per vehicle per 10 minutes)
  if v_limit is not null and v_speed > v_limit
     and not exists (select 1 from public.alerts
                      where vehicle_id = new.vehicle_id and type = 'overspeed'
                        and created_at > now() - interval '10 minutes') then
    perform public.create_alert(new.organization_id, new.vehicle_id, new.driver_id, 'overspeed', 'warning',
      format('%s over speed limit', v_reg),
      format('Recorded %s km/h against a limit of %s km/h.', round(v_speed::numeric, 0), v_limit),
      new.latitude, new.longitude, jsonb_build_object('speed_kmh', v_speed, 'limit_kmh', v_limit));
  end if;

  -- Geofences. The first observation only records state (no alert), so
  -- registering a geofence around a parked vehicle does not raise a false entry.
  for v_gf in select * from public.geofences
               where organization_id = new.organization_id and is_active loop
    v_inside := public.app_inside_geofence(v_gf, new.geom);
    select g.inside into v_prev from public.vehicle_geofence_state g
     where g.vehicle_id = new.vehicle_id and g.geofence_id = v_gf.id;
    v_prev_found := found;

    if not v_prev_found then
      insert into public.vehicle_geofence_state (vehicle_id, geofence_id, organization_id, inside, changed_at)
      values (new.vehicle_id, v_gf.id, new.organization_id, v_inside, new.device_time);
    elsif v_prev is distinct from v_inside then
      update public.vehicle_geofence_state set inside = v_inside, changed_at = new.device_time
       where vehicle_id = new.vehicle_id and geofence_id = v_gf.id;
      insert into public.geofence_events (organization_id, vehicle_id, geofence_id, event, occurred_at, latitude, longitude)
      values (new.organization_id, new.vehicle_id, v_gf.id, case when v_inside then 'entry' else 'exit' end,
              new.device_time, new.latitude, new.longitude);
      if (v_inside and v_gf.alert_on_entry) or (not v_inside and v_gf.alert_on_exit) then
        perform public.create_alert(new.organization_id, new.vehicle_id, new.driver_id,
          case when v_inside then 'geofence_entry' else 'geofence_exit' end,
          case when v_gf.category = 'restricted' then 'critical' else 'info' end,
          format('%s %s %s', v_reg, case when v_inside then 'entered' else 'left' end, v_gf.name),
          format('Geofence "%s" (%s).', v_gf.name, v_gf.category),
          new.latitude, new.longitude, jsonb_build_object('geofence_id', v_gf.id));
      end if;
    end if;
  end loop;

  return new;
end $$;

create trigger vehicle_positions_process
  after insert on public.vehicle_positions
  for each row execute function public.process_position();

-- ---------------------------------------------------------------------
-- Ingestion: hardware trackers (called by the Traccar webhook, service role)
-- ---------------------------------------------------------------------
create or replace function public.ingest_hardware_position(
  p_identifier text,
  p_latitude double precision,
  p_longitude double precision,
  p_speed_kmh double precision default 0,
  p_heading double precision default null,
  p_ignition boolean default null,
  p_device_time timestamptz default null,
  p_accuracy_m double precision default null
) returns bigint language plpgsql security definer set search_path = public, extensions as $$
declare
  v_device public.gps_devices%rowtype;
  v_time timestamptz := coalesce(p_device_time, now());
  v_driver uuid;
  v_id bigint;
begin
  select * into v_device from public.gps_devices
   where imei = trim(p_identifier) or provider_device_id = trim(p_identifier)
   order by (imei = trim(p_identifier)) desc limit 1;
  if not found then raise exception 'unknown_device'; end if;
  if v_device.status <> 'active' then return null; end if;

  if p_latitude is null or p_longitude is null
     or p_latitude not between -90 and 90 or p_longitude not between -180 and 180 then
    raise exception 'invalid_coordinates';
  end if;
  if v_time > now() + interval '5 minutes' then v_time := now(); end if;

  -- Any contact proves the device is alive, even if it is not yet linked to a vehicle.
  update public.gps_devices set last_communication_at = now() where id = v_device.id;
  if v_device.vehicle_id is null then return null; end if;

  select a.driver_id into v_driver from public.vehicle_assignments a
   where a.vehicle_id = v_device.vehicle_id and a.unassigned_at is null;

  insert into public.vehicle_positions (
    organization_id, vehicle_id, device_id, driver_id, geom, latitude, longitude,
    speed_kmh, heading, accuracy_m, ignition, source, device_time)
  values (
    v_device.organization_id, v_device.vehicle_id, v_device.id, v_driver,
    public.app_point(p_longitude, p_latitude), p_latitude, p_longitude,
    greatest(coalesce(p_speed_kmh, 0), 0),
    case when p_heading is null then null else mod(mod(p_heading::numeric, 360) + 360, 360)::double precision end,
    p_accuracy_m, p_ignition, 'hardware', v_time)
  on conflict (vehicle_id, device_time, source) do nothing
  returning id into v_id;
  return v_id;
end $$;

revoke all on function public.ingest_hardware_position(text, double precision, double precision, double precision, double precision, boolean, timestamptz, double precision)
  from public, anon, authenticated;
grant execute on function public.ingest_hardware_position(text, double precision, double precision, double precision, double precision, boolean, timestamptz, double precision)
  to service_role;

-- ---------------------------------------------------------------------
-- Ingestion: smartphone (driver app). Requires login, assignment and consent.
-- ---------------------------------------------------------------------
create or replace function public.ingest_phone_position(
  p_latitude double precision,
  p_longitude double precision,
  p_speed_kmh double precision default 0,
  p_heading double precision default null,
  p_accuracy_m double precision default null,
  p_device_time timestamptz default null
) returns bigint language plpgsql security definer set search_path = public, extensions as $$
declare
  v_driver_id uuid;
  v_org uuid;
  v_vehicle uuid;
  v_time timestamptz := coalesce(p_device_time, now());
  v_id bigint;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if p_latitude is null or p_longitude is null
     or p_latitude not between -90 and 90 or p_longitude not between -180 and 180 then
    raise exception 'invalid_coordinates';
  end if;
  if v_time > now() + interval '5 minutes' then v_time := now(); end if;

  select d.id, d.organization_id, a.vehicle_id into v_driver_id, v_org, v_vehicle
    from public.drivers d
    join public.vehicle_assignments a on a.driver_id = d.id and a.unassigned_at is null
   where d.user_id = auth.uid() and d.status = 'active' and public.is_org_member(d.organization_id)
   limit 1;
  if not found then raise exception 'no_assignment'; end if;

  if not exists (
    select 1 from public.tracking_consents c
     where c.driver_id = v_driver_id and c.user_id = auth.uid()
       and c.withdrawn_at is null
  ) then
    raise exception 'consent_required';
  end if;

  insert into public.vehicle_positions (
    organization_id, vehicle_id, device_id, driver_id, geom, latitude, longitude,
    speed_kmh, heading, accuracy_m, ignition, source, device_time)
  values (
    v_org, v_vehicle, null, v_driver_id,
    public.app_point(p_longitude, p_latitude), p_latitude, p_longitude,
    greatest(coalesce(p_speed_kmh, 0), 0),
    case when p_heading is null then null else mod(mod(p_heading::numeric, 360) + 360, 360)::double precision end,
    p_accuracy_m, null, 'smartphone', v_time)
  on conflict (vehicle_id, device_time, source) do nothing
  returning id into v_id;
  return v_id;
end $$;

revoke all on function public.ingest_phone_position(double precision, double precision, double precision, double precision, double precision, timestamptz)
  from public, anon;
grant execute on function public.ingest_phone_position(double precision, double precision, double precision, double precision, double precision, timestamptz)
  to authenticated;

-- Batch version used by the mobile offline queue. Returns how many rows were new.
create or replace function public.ingest_phone_positions(p_points jsonb)
returns integer language plpgsql security definer set search_path = public, extensions as $$
declare
  v_pt jsonb;
  v_count integer := 0;
  v_id bigint;
begin
  if jsonb_typeof(p_points) <> 'array' then raise exception 'invalid_payload'; end if;
  if jsonb_array_length(p_points) > 500 then raise exception 'batch_too_large'; end if;
  for v_pt in select * from jsonb_array_elements(p_points) loop
    v_id := public.ingest_phone_position(
      (v_pt ->> 'latitude')::double precision,
      (v_pt ->> 'longitude')::double precision,
      coalesce((v_pt ->> 'speed_kmh')::double precision, 0),
      (v_pt ->> 'heading')::double precision,
      (v_pt ->> 'accuracy_m')::double precision,
      (v_pt ->> 'device_time')::timestamptz);
    if v_id is not null then v_count := v_count + 1; end if;
  end loop;
  return v_count;
end $$;

revoke all on function public.ingest_phone_positions(jsonb) from public, anon;
grant execute on function public.ingest_phone_positions(jsonb) to authenticated;

-- ---------------------------------------------------------------------
-- Tracking consent (driver controls)
-- ---------------------------------------------------------------------
create or replace function public.set_tracking_consent(p_granted boolean, p_policy_version text default 'v1')
returns void language plpgsql security definer set search_path = public as $$
declare v_driver record;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if not exists (select 1 from public.drivers where user_id = auth.uid()) then
    raise exception 'not_a_driver';
  end if;
  for v_driver in select id, organization_id from public.drivers
                   where user_id = auth.uid() and public.is_org_member(organization_id) loop
    if p_granted then
      if not exists (select 1 from public.tracking_consents
                      where driver_id = v_driver.id and user_id = auth.uid() and withdrawn_at is null) then
        insert into public.tracking_consents (organization_id, driver_id, user_id, policy_version)
        values (v_driver.organization_id, v_driver.id, auth.uid(), coalesce(p_policy_version, 'v1'));
      end if;
    else
      update public.tracking_consents set withdrawn_at = now()
       where driver_id = v_driver.id and user_id = auth.uid() and withdrawn_at is null;
    end if;
  end loop;
end $$;

revoke all on function public.set_tracking_consent(boolean, text) from public, anon;
grant execute on function public.set_tracking_consent(boolean, text) to authenticated;

-- ---------------------------------------------------------------------
-- Geofence upsert (circle or polygon)
-- ---------------------------------------------------------------------
create or replace function public.upsert_geofence(
  p_org uuid,
  p_id uuid,
  p_name text,
  p_category text,
  p_shape text,
  p_center_lat double precision default null,
  p_center_lon double precision default null,
  p_radius_m double precision default null,
  p_polygon jsonb default null,   -- [[lon,lat],[lon,lat],...]
  p_alert_on_entry boolean default true,
  p_alert_on_exit boolean default true,
  p_is_active boolean default true
) returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare
  v_id uuid := coalesce(p_id, gen_random_uuid());
  v_center geography;
  v_boundary geography;
  v_wkt text;
  v_pts jsonb;
  v_n integer;
begin
  if not public.can_manage_fleet(p_org) then raise exception 'forbidden'; end if;
  if p_shape = 'circle' then
    if p_center_lat is null or p_center_lon is null or p_radius_m is null or p_radius_m <= 0
       or p_center_lat not between -90 and 90 or p_center_lon not between -180 and 180 then
      raise exception 'invalid_circle';
    end if;
    v_center := public.app_point(p_center_lon, p_center_lat);
  elsif p_shape = 'polygon' then
    if p_polygon is null or jsonb_typeof(p_polygon) <> 'array' or jsonb_array_length(p_polygon) < 3 then
      raise exception 'invalid_polygon';
    end if;
    v_pts := p_polygon;
    v_n := jsonb_array_length(v_pts);
    -- close the ring if needed
    if (v_pts -> 0) is distinct from (v_pts -> (v_n - 1)) then
      v_pts := v_pts || jsonb_build_array(v_pts -> 0);
    end if;
    select 'POLYGON((' || string_agg((pt ->> 0) || ' ' || (pt ->> 1), ',') || '))'
      into v_wkt from jsonb_array_elements(v_pts) pt;
    v_boundary := st_geogfromtext(v_wkt);
    p_center_lat := (p_polygon -> 0 ->> 1)::double precision;
    p_center_lon := (p_polygon -> 0 ->> 0)::double precision;
  else
    raise exception 'invalid_shape';
  end if;

  if exists (select 1 from public.geofences where id = v_id and organization_id <> p_org) then
    raise exception 'forbidden';
  end if;

  insert into public.geofences as g (
    id, organization_id, name, category, shape, center_latitude, center_longitude, radius_m,
    polygon_coords, center, boundary, alert_on_entry, alert_on_exit, is_active, created_by)
  values (
    v_id, p_org, p_name, p_category, p_shape, p_center_lat, p_center_lon,
    case when p_shape = 'circle' then p_radius_m end,
    case when p_shape = 'polygon' then p_polygon end,
    v_center, v_boundary, p_alert_on_entry, p_alert_on_exit, p_is_active, auth.uid())
  on conflict (id) do update set
    name = excluded.name, category = excluded.category, shape = excluded.shape,
    center_latitude = excluded.center_latitude, center_longitude = excluded.center_longitude,
    radius_m = excluded.radius_m, polygon_coords = excluded.polygon_coords,
    center = excluded.center, boundary = excluded.boundary,
    alert_on_entry = excluded.alert_on_entry, alert_on_exit = excluded.alert_on_exit,
    is_active = excluded.is_active;

  -- Shape changed: forget old inside/outside so the next fix re-baselines silently.
  delete from public.vehicle_geofence_state where geofence_id = v_id;
  return v_id;
end $$;

revoke all on function public.upsert_geofence(uuid, uuid, text, text, text, double precision, double precision, double precision, jsonb, boolean, boolean, boolean) from public, anon;
grant execute on function public.upsert_geofence(uuid, uuid, text, text, text, double precision, double precision, double precision, jsonb, boolean, boolean, boolean) to authenticated;

-- ---------------------------------------------------------------------
-- Live status view (RLS applies to the caller)
-- connection_state is based on the age of the last GPS fix, never on
-- whether a device is merely registered.
-- ---------------------------------------------------------------------
create or replace view public.vehicle_live_status with (security_invoker = true) as
select
  v.id as vehicle_id,
  v.organization_id,
  v.registration_number,
  v.make,
  v.model,
  v.category,
  v.status as vehicle_status,
  cs.latitude,
  cs.longitude,
  cs.speed_kmh,
  cs.heading,
  cs.ignition,
  cs.source as tracking_source,
  cs.device_time as last_fix_at,
  cs.received_at as last_received_at,
  cs.motion_state,
  cs.active_trip_id,
  d.id as device_id,
  d.last_communication_at as device_last_communication_at,
  a.driver_id,
  dr.full_name as driver_name,
  case
    when cs.vehicle_id is null or cs.device_time is null then 'never_reported'
    when now() - cs.device_time <= make_interval(secs => o.stale_after_seconds) then 'live'
    when now() - cs.device_time <= make_interval(secs => o.offline_after_seconds) then 'stale'
    else 'offline'
  end as connection_state,
  case when cs.device_time is null then null
       else extract(epoch from (now() - cs.device_time))::integer end as seconds_since_fix
from public.vehicles v
join public.organizations o on o.id = v.organization_id
left join public.vehicle_current_state cs on cs.vehicle_id = v.id
left join lateral (
  select g.id, g.last_communication_at from public.gps_devices g
   where g.vehicle_id = v.id and g.status = 'active'
   order by g.last_communication_at desc nulls last limit 1
) d on true
left join public.vehicle_assignments a on a.vehicle_id = v.id and a.unassigned_at is null
left join public.drivers dr on dr.id = a.driver_id;

create or replace view public.driver_consent_status with (security_invoker = true) as
select dr.id as driver_id, dr.organization_id,
       (c.id is not null and c.withdrawn_at is null) as consented,
       c.granted_at, c.withdrawn_at, c.policy_version
from public.drivers dr
left join lateral (
  select * from public.tracking_consents t where t.driver_id = dr.id
   order by t.granted_at desc limit 1
) c on true;

-- ---------------------------------------------------------------------
-- Dashboard numbers (all from real rows; RLS applies)
-- ---------------------------------------------------------------------
create or replace function public.dashboard_summary(p_org uuid)
returns jsonb language plpgsql stable set search_path = public as $$
declare
  v_result jsonb;
begin
  select jsonb_build_object(
    'total_vehicles', (select count(*) from public.vehicles where organization_id = p_org and status <> 'retired'),
    'active_vehicles', (select count(*) from public.vehicles where organization_id = p_org and status = 'active'),
    'inactive_vehicles', (select count(*) from public.vehicles where organization_id = p_org and status in ('inactive', 'maintenance')),
    'moving', (select count(*) from public.vehicle_live_status where organization_id = p_org and connection_state = 'live' and motion_state = 'moving'),
    'idle', (select count(*) from public.vehicle_live_status where organization_id = p_org and connection_state = 'live' and motion_state = 'idle'),
    'stopped', (select count(*) from public.vehicle_live_status where organization_id = p_org and connection_state = 'live' and motion_state = 'stopped'),
    'stale', (select count(*) from public.vehicle_live_status where organization_id = p_org and connection_state = 'stale'),
    'offline', (select count(*) from public.vehicle_live_status where organization_id = p_org and connection_state = 'offline'),
    'never_reported', (select count(*) from public.vehicle_live_status where organization_id = p_org and connection_state = 'never_reported' and vehicle_status <> 'retired'),
    'active_trips', (select count(*) from public.trips where organization_id = p_org and status = 'in_progress'),
    'total_drivers', (select count(*) from public.drivers where organization_id = p_org and status = 'active'),
    'open_alerts', (select count(*) from public.alerts where organization_id = p_org and status <> 'resolved'),
    'critical_alerts', (select count(*) from public.alerts where organization_id = p_org and status <> 'resolved' and severity = 'critical'),
    'maintenance_due', (select count(*) from public.maintenance_records
                         where organization_id = p_org and status in ('scheduled', 'in_progress')
                           and service_date <= current_date + 14),
    'distance_30d_km', (select coalesce(round(sum(distance_km), 1), 0) from public.trips
                         where organization_id = p_org and started_at >= now() - interval '30 days'),
    'trips_30d', (select count(*) from public.trips
                   where organization_id = p_org and started_at >= now() - interval '30 days'),
    'completed_trips_30d', (select count(*) from public.trips
                             where organization_id = p_org and status = 'completed' and started_at >= now() - interval '30 days'),
    'fuel_30d', (select coalesce(jsonb_agg(jsonb_build_object('currency', currency, 'total', total, 'litres', litres)), '[]'::jsonb)
                   from (select currency, round(sum(total_cost), 2) as total, round(sum(litres), 1) as litres
                           from public.fuel_records
                          where organization_id = p_org and fueled_at >= current_date - 30
                          group by currency) f),
    'maintenance_30d', (select coalesce(jsonb_agg(jsonb_build_object('currency', currency, 'total', total)), '[]'::jsonb)
                          from (select currency, round(sum(cost), 2) as total
                                  from public.maintenance_records
                                 where organization_id = p_org and status = 'completed'
                                   and service_date >= current_date - 30
                                 group by currency) m)
  ) into v_result;
  return v_result;
end $$;

grant execute on function public.dashboard_summary(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Scheduled checks (call from cron: pg_cron or the /api/cron/checks route)
-- ---------------------------------------------------------------------
create or replace function public.run_scheduled_checks()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  r record;
  v_offline integer := 0;
  v_maint integer := 0;
begin
  for r in
    select g.id as device_id, g.vehicle_id, g.organization_id, g.last_communication_at,
           v.registration_number
      from public.gps_devices g
      join public.organizations o on o.id = g.organization_id and o.status = 'active'
      join public.vehicles v on v.id = g.vehicle_id and v.status = 'active'
     where g.status = 'active' and g.last_communication_at is not null
       and g.last_communication_at < now() - make_interval(
             secs => greatest(o.offline_after_seconds, g.expected_interval_seconds * 3))
       and not exists (select 1 from public.alerts a
                        where a.vehicle_id = g.vehicle_id and a.type = 'device_offline' and a.status <> 'resolved')
  loop
    perform public.create_alert(r.organization_id, r.vehicle_id, null, 'device_offline', 'warning',
      format('%s tracker offline', r.registration_number),
      format('No data received since %s.', to_char(r.last_communication_at at time zone 'UTC', 'YYYY-MM-DD HH24:MI "UTC"')),
      null, null, jsonb_build_object('device_id', r.device_id));
    v_offline := v_offline + 1;
  end loop;

  for r in
    select m.id as record_id, m.organization_id, m.vehicle_id, m.maintenance_type, m.service_date,
           v.registration_number
      from public.maintenance_records m
      join public.vehicles v on v.id = m.vehicle_id
     where m.status = 'scheduled' and m.service_date <= current_date + 7
       and not exists (select 1 from public.alerts a
                        where a.type = 'maintenance_due' and a.metadata ->> 'maintenance_id' = m.id::text)
  loop
    perform public.create_alert(r.organization_id, r.vehicle_id, null, 'maintenance_due',
      case when r.service_date < current_date then 'critical' else 'warning' end,
      format('%s: %s due', r.registration_number, r.maintenance_type),
      format('Scheduled for %s.', r.service_date), null, null,
      jsonb_build_object('maintenance_id', r.record_id));
    v_maint := v_maint + 1;
  end loop;

  return jsonb_build_object('offline_alerts', v_offline, 'maintenance_alerts', v_maint);
end $$;

revoke all on function public.run_scheduled_checks() from public, anon, authenticated;
grant execute on function public.run_scheduled_checks() to service_role;

create or replace function public.purge_old_positions()
returns bigint language plpgsql security definer set search_path = public as $$
declare v_deleted bigint;
begin
  delete from public.vehicle_positions p
   using public.organizations o
   where p.organization_id = o.id
     and p.received_at < now() - make_interval(days => o.position_retention_days);
  get diagnostics v_deleted = row_count;
  return v_deleted;
end $$;

revoke all on function public.purge_old_positions() from public, anon, authenticated;
grant execute on function public.purge_old_positions() to service_role;

-- ---------------------------------------------------------------------
-- Platform administration (does NOT grant access to tenant fleet data)
-- ---------------------------------------------------------------------
create or replace function public.platform_overview()
returns table (
  organization_id uuid, name text, status text, plan text, subscription_status text,
  vehicles bigint, members bigint, created_at timestamptz
) language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then raise exception 'forbidden'; end if;
  return query
  select o.id, o.name, o.status, s.plan, s.status,
         (select count(*) from public.vehicles v where v.organization_id = o.id and v.status <> 'retired'),
         (select count(*) from public.organization_memberships m where m.organization_id = o.id and m.status = 'active'),
         o.created_at
    from public.organizations o
    left join public.subscription_accounts s on s.organization_id = o.id
   order by o.created_at desc;
end $$;
grant execute on function public.platform_overview() to authenticated;

create or replace function public.platform_set_org_status(p_org uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then raise exception 'forbidden'; end if;
  if p_status not in ('active', 'suspended') then raise exception 'invalid_status'; end if;
  update public.organizations set status = p_status where id = p_org;
end $$;
grant execute on function public.platform_set_org_status(uuid, text) to authenticated;

create or replace function public.platform_set_subscription(
  p_org uuid, p_plan text, p_status text, p_vehicle_limit integer default null,
  p_user_limit integer default null, p_period_end timestamptz default null
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then raise exception 'forbidden'; end if;
  update public.subscription_accounts
     set plan = p_plan, status = p_status, vehicle_limit = p_vehicle_limit,
         user_limit = p_user_limit, current_period_end = p_period_end, updated_at = now()
   where organization_id = p_org;
end $$;
grant execute on function public.platform_set_subscription(uuid, text, text, integer, integer, timestamptz) to authenticated;


-- =====================================================================
-- VEKTOR Migration 0003: plans, billing records, AI usage
-- =====================================================================
-- No payment provider is connected yet. Plan changes are recorded as
-- requests and applied by a platform administrator until a Zimbabwe-capable
-- payment provider (e.g. Paynow / EcoCash gateway) is integrated.
-- Prices below are INDICATIVE test prices from the project guide.
-- =====================================================================

create table public.plans (
  code text primary key,
  name text not null,
  price_usd numeric not null check (price_usd >= 0),
  billing_unit text not null check (billing_unit in ('vehicle', 'driver', 'organisation')),
  description text,
  is_indicative boolean not null default true,
  sort_order integer not null default 0
);

insert into public.plans (code, name, price_usd, billing_unit, description, sort_order) values
  ('essential', 'Essential', 5.00, 'vehicle', 'Live tracking, trips, geofences and basic reports.', 1),
  ('fleet', 'Fleet', 7.50, 'vehicle', 'Everything in Essential plus maintenance, fuel and analytics.', 2),
  ('enterprise', 'Enterprise', 10.00, 'vehicle', 'Priority support, integrations and extended retention (from US$10, up to US$12).', 3),
  ('smartphone', 'Smartphone-only', 3.50, 'driver', 'Consent-based smartphone tracking for drivers without hardware trackers.', 4)
on conflict (code) do nothing;

create table public.billing_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  event_type text not null check (event_type in (
    'plan_change_requested', 'plan_activated', 'invoice_issued', 'payment_recorded', 'cancellation_requested')),
  plan text,
  amount_usd numeric,
  currency text not null default 'USD',
  reference text,
  note text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index on public.billing_events (organization_id, created_at desc);

create table public.ai_usage (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text,
  created_at timestamptz not null default now()
);
create index on public.ai_usage (organization_id, created_at desc);
create index on public.ai_usage (user_id, created_at desc);

alter table public.plans enable row level security;
alter table public.billing_events enable row level security;
alter table public.ai_usage enable row level security;

create policy plans_select on public.plans for select to authenticated using (true);
create policy billing_select on public.billing_events for select to authenticated using (
  public.is_org_admin(organization_id) or public.is_platform_admin()
);
create policy ai_usage_select on public.ai_usage for select to authenticated using (
  user_id = auth.uid() or public.is_org_admin(organization_id)
);

-- Owner requests a plan change / cancellation. A platform admin applies it.
create or replace function public.request_plan_change(p_org uuid, p_plan text, p_cancel boolean default false)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if public.org_role_of(p_org) is distinct from 'owner' then raise exception 'forbidden'; end if;
  if not p_cancel and not exists (select 1 from public.plans where code = p_plan) then
    raise exception 'unknown_plan';
  end if;
  insert into public.billing_events (organization_id, event_type, plan, created_by)
  values (p_org, case when p_cancel then 'cancellation_requested' else 'plan_change_requested' end,
          case when p_cancel then null else p_plan end, auth.uid())
  returning id into v_id;
  return v_id;
end $$;
grant execute on function public.request_plan_change(uuid, text, boolean) to authenticated;

-- ---------------------------------------------------------------------
-- Storage: private bucket for fuel receipts, path = <organization_id>/<file>
-- ---------------------------------------------------------------------
do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public) values ('receipts', 'receipts', false)
    on conflict (id) do nothing;

    execute $p$ create policy receipts_read on storage.objects for select to authenticated
      using (bucket_id = 'receipts'
             and public.is_staff(((storage.foldername(name))[1])::uuid)) $p$;
    execute $p$ create policy receipts_insert on storage.objects for insert to authenticated
      with check (bucket_id = 'receipts'
                  and public.can_dispatch(((storage.foldername(name))[1])::uuid)) $p$;
    execute $p$ create policy receipts_delete on storage.objects for delete to authenticated
      using (bucket_id = 'receipts'
             and public.can_manage_fleet(((storage.foldername(name))[1])::uuid)) $p$;
  end if;
end $$;


-- =====================================================================
-- VEKTOR Migration 0004: privileges, realtime, optional cron
-- =====================================================================

-- Anonymous visitors never touch tenant tables.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;

-- Signed-in users: RLS decides which rows.
grant usage on schema public to authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;

-- Tables clients may never write directly (written by trusted functions only)
revoke insert, update, delete on
  public.vehicle_positions, public.vehicle_current_state, public.vehicle_geofence_state,
  public.geofence_events, public.audit_logs, public.ai_usage, public.billing_events,
  public.plans, public.subscription_accounts, public.organization_memberships,
  public.organization_invitations, public.vehicle_assignments, public.tracking_consents
from authenticated;
revoke insert, delete on public.alerts, public.notifications, public.organizations, public.user_profiles
  from authenticated;
revoke insert on public.geofences from authenticated;

-- Column-level protection for privileged fields
revoke update on public.user_profiles from authenticated;
grant update (full_name, phone, avatar_url) on public.user_profiles to authenticated;

revoke update on public.organizations from authenticated;
grant update (
  name, contact_email, contact_phone, country, timezone, currency,
  trip_start_speed_kmh, trip_end_speed_kmh, trip_end_minutes,
  stale_after_seconds, offline_after_seconds, position_retention_days
) on public.organizations to authenticated;

revoke update on public.alerts from authenticated;
grant update (status, acknowledged_by, acknowledged_at, resolved_at, resolution_notes) on public.alerts to authenticated;

revoke update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;

-- Views run with the caller's rights (security_invoker) so RLS still applies.
grant select on public.vehicle_live_status, public.driver_consent_status to authenticated;

-- Future tables in this schema do not silently become client-writable.
alter default privileges in schema public revoke all on tables from anon;

-- ---------------------------------------------------------------------
-- Realtime: live map and alert feed
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.vehicle_current_state;
    exception when duplicate_object then null; end;
    begin
      alter publication supabase_realtime add table public.alerts;
    exception when duplicate_object then null; end;
    begin
      alter publication supabase_realtime add table public.notifications;
    exception when duplicate_object then null; end;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Optional pg_cron schedule. If pg_cron is not enabled, call
-- POST /api/cron/checks (see vercel.json) instead - both run the same function.
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    begin
      create extension if not exists pg_cron;
      perform cron.schedule('vektor-scheduled-checks', '*/5 * * * *', 'select public.run_scheduled_checks()');
      perform cron.schedule('vektor-purge-positions', '30 2 * * *', 'select public.purge_old_positions()');
    exception when others then
      raise notice 'pg_cron not configured: %', sqlerrm;
    end;
  end if;
end $$;
