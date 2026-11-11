-- Madrude Fleet Intelligence tenant-first schema. Apply to a fresh Supabase project.
create extension if not exists pgcrypto;
create extension if not exists postgis with schema extensions;

create type public.organization_role as enum ('owner','admin','fleet_manager','dispatcher','driver','analyst');
create type public.subscription_status as enum ('trialing','active','past_due','canceled','incomplete');
create type public.gps_source as enum ('traccar','mobile');
create type public.tracking_consent_status as enum ('granted','withdrawn');

create table public.user_profiles(user_id uuid primary key references auth.users(id) on delete cascade,full_name text,phone text,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table public.organizations(id uuid primary key default gen_random_uuid(),name text not null check(length(trim(name)) between 2 and 120),slug text not null unique,created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table public.organization_memberships(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id) on delete cascade,user_id uuid not null references auth.users(id) on delete cascade,role public.organization_role not null default 'analyst',created_at timestamptz not null default now(),unique(organization_id,user_id),unique(id,organization_id));
create index memberships_user_idx on public.organization_memberships(user_id,organization_id);
create table public.subscription_accounts(id uuid primary key default gen_random_uuid(),organization_id uuid not null unique references public.organizations(id) on delete cascade,plan_code text not null default 'trial',status public.subscription_status not null default 'trialing',trial_ends_at timestamptz default(now()+interval '14 days'),billing_customer_id text,billing_subscription_id text,current_period_end timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now());

create table public.vehicles(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id) on delete cascade,registration_number text not null,make text,model text,year integer check(year is null or year between 1900 and 2200),status text not null default 'active' check(status in('active','inactive','maintenance','retired')),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(organization_id,registration_number),unique(id,organization_id));
create table public.drivers(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id) on delete cascade,user_id uuid references auth.users(id) on delete set null,full_name text not null,phone text,licence_number text,licence_expiry date,status text not null default 'active' check(status in('active','inactive','suspended')),created_at timestamptz not null default now(),unique(id,organization_id));
create table public.gps_devices(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id) on delete cascade,vehicle_id uuid,provider text not null default 'traccar',provider_device_id text,unique_id text not null,label text,last_seen_at timestamptz,active boolean not null default true,created_at timestamptz not null default now(),foreign key(vehicle_id,organization_id) references public.vehicles(id,organization_id) on delete cascade,unique(organization_id,unique_id),unique(id,organization_id));
create table public.vehicle_assignments(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id) on delete cascade,vehicle_id uuid not null,driver_id uuid not null,starts_at timestamptz not null default now(),ends_at timestamptz,created_at timestamptz not null default now(),foreign key(vehicle_id,organization_id) references public.vehicles(id,organization_id) on delete cascade,foreign key(driver_id,organization_id) references public.drivers(id,organization_id) on delete cascade,check(ends_at is null or ends_at>starts_at));
create table public.vehicle_positions(id bigserial primary key,organization_id uuid not null references public.organizations(id) on delete cascade,vehicle_id uuid not null,gps_device_id uuid,source public.gps_source not null,position geography(point,4326) not null,device_time timestamptz not null,received_at timestamptz not null default now(),accuracy_m real,speed_kph real,heading_deg real,quality_flags jsonb not null default '[]'::jsonb,foreign key(vehicle_id,organization_id) references public.vehicles(id,organization_id) on delete cascade,foreign key(gps_device_id,organization_id) references public.gps_devices(id,organization_id) on delete restrict);
create index vehicle_positions_org_time_idx on public.vehicle_positions(organization_id,device_time desc);
create index vehicle_positions_geo_idx on public.vehicle_positions using gist(position);
create table public.vehicle_current_state(vehicle_id uuid primary key,organization_id uuid not null references public.organizations(id) on delete cascade,position geography(point,4326),device_time timestamptz,received_at timestamptz,speed_kph real,heading_deg real,source public.gps_source,is_stale boolean not null default true,updated_at timestamptz not null default now(),foreign key(vehicle_id,organization_id) references public.vehicles(id,organization_id) on delete cascade);
create table public.trips(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id) on delete cascade,vehicle_id uuid not null,driver_id uuid,started_at timestamptz not null,ended_at timestamptz,start_position geography(point,4326),end_position geography(point,4326),distance_km numeric(10,2),status text not null default 'in_progress' check(status in('in_progress','completed','review')),created_at timestamptz not null default now(),foreign key(vehicle_id,organization_id) references public.vehicles(id,organization_id) on delete cascade,foreign key(driver_id,organization_id) references public.drivers(id,organization_id) on delete restrict,check(ended_at is null or ended_at>=started_at));
create table public.geofences(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id) on delete cascade,name text not null,area geography(polygon,4326) not null,enabled boolean not null default true,created_at timestamptz not null default now());
create table public.alerts(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id) on delete cascade,vehicle_id uuid,alert_type text not null,severity text not null default 'info' check(severity in('info','warning','critical')),message text not null,occurred_at timestamptz not null default now(),acknowledged_at timestamptz,acknowledged_by uuid references auth.users(id),foreign key(vehicle_id,organization_id) references public.vehicles(id,organization_id) on delete restrict);
create table public.maintenance_records(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id) on delete cascade,vehicle_id uuid not null,title text not null,details text,scheduled_at timestamptz,completed_at timestamptz,cost numeric(12,2),currency char(3) not null default 'USD',created_at timestamptz not null default now(),foreign key(vehicle_id,organization_id) references public.vehicles(id,organization_id) on delete cascade);
create table public.fuel_records(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id) on delete cascade,vehicle_id uuid not null,quantity_litres numeric(10,2) not null check(quantity_litres>0),total_cost numeric(12,2) not null check(total_cost>=0),currency char(3) not null default 'USD',odometer_km numeric(12,1),filled_at timestamptz not null default now(),foreign key(vehicle_id,organization_id) references public.vehicles(id,organization_id) on delete cascade);
create table public.tracking_consents(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id) on delete cascade,driver_id uuid not null,status public.tracking_consent_status not null,purpose text not null,policy_version text not null,granted_at timestamptz,withdrawn_at timestamptz,recorded_at timestamptz not null default now(),foreign key(driver_id,organization_id) references public.drivers(id,organization_id) on delete cascade);
create table public.audit_logs(id bigserial primary key,organization_id uuid references public.organizations(id) on delete cascade,actor_user_id uuid references auth.users(id) on delete set null,action text not null,resource_type text not null,resource_id text,metadata jsonb not null default '{}'::jsonb,created_at timestamptz not null default now());

create or replace function public.is_org_member(target_org uuid) returns boolean language sql stable security definer set search_path=public,auth as $$ select exists(select 1 from public.organization_memberships m where m.organization_id=target_org and m.user_id=auth.uid()); $$;
create or replace function public.has_org_role(target_org uuid,allowed public.organization_role[]) returns boolean language sql stable security definer set search_path=public,auth as $$ select exists(select 1 from public.organization_memberships m where m.organization_id=target_org and m.user_id=auth.uid() and m.role=any(allowed)); $$;
revoke all on function public.is_org_member(uuid) from public;
revoke all on function public.has_org_role(uuid,public.organization_role[]) from public;
grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.has_org_role(uuid,public.organization_role[]) to authenticated;

create or replace function public.create_organization_with_owner(org_name text,org_slug text) returns uuid language plpgsql security definer set search_path=public,auth as $$
declare new_org_id uuid;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if length(trim(org_name))<2 or length(trim(org_name))>120 then raise exception 'Invalid organization name'; end if;
 if org_slug !~ '^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$' then raise exception 'Invalid organization slug'; end if;
 insert into public.organizations(name,slug,created_by) values(trim(org_name),org_slug,auth.uid()) returning id into new_org_id;
 insert into public.organization_memberships(organization_id,user_id,role) values(new_org_id,auth.uid(),'owner');
 insert into public.subscription_accounts(organization_id) values(new_org_id);
 return new_org_id;
end; $$;
revoke all on function public.create_organization_with_owner(text,text) from public;
grant execute on function public.create_organization_with_owner(text,text) to authenticated;

alter table public.user_profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.subscription_accounts enable row level security;
alter table public.vehicles enable row level security;
alter table public.drivers enable row level security;
alter table public.gps_devices enable row level security;
alter table public.vehicle_assignments enable row level security;
alter table public.vehicle_positions enable row level security;
alter table public.vehicle_current_state enable row level security;
alter table public.trips enable row level security;
alter table public.geofences enable row level security;
alter table public.alerts enable row level security;
alter table public.maintenance_records enable row level security;
alter table public.fuel_records enable row level security;
alter table public.tracking_consents enable row level security;
alter table public.audit_logs enable row level security;

create policy "own profile" on public.user_profiles for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy "member organization read" on public.organizations for select to authenticated using(public.is_org_member(id));
create policy "organization admin update" on public.organizations for update to authenticated using(public.has_org_role(id,array['owner','admin']::public.organization_role[])) with check(public.has_org_role(id,array['owner','admin']::public.organization_role[]));
create policy "membership read" on public.organization_memberships for select to authenticated using(public.is_org_member(organization_id));
create policy "membership admin" on public.organization_memberships for all to authenticated using(public.has_org_role(organization_id,array['owner','admin']::public.organization_role[])) with check(public.has_org_role(organization_id,array['owner','admin']::public.organization_role[]));
create policy "subscription read" on public.subscription_accounts for select to authenticated using(public.is_org_member(organization_id));

create policy "vehicles read" on public.vehicles for select to authenticated using(public.is_org_member(organization_id));
create policy "vehicles manage" on public.vehicles for all to authenticated using(public.has_org_role(organization_id,array['owner','admin','fleet_manager']::public.organization_role[])) with check(public.has_org_role(organization_id,array['owner','admin','fleet_manager']::public.organization_role[]));
create policy "drivers read" on public.drivers for select to authenticated using(public.is_org_member(organization_id));
create policy "drivers manage" on public.drivers for all to authenticated using(public.has_org_role(organization_id,array['owner','admin','fleet_manager','dispatcher']::public.organization_role[])) with check(public.has_org_role(organization_id,array['owner','admin','fleet_manager','dispatcher']::public.organization_role[]));
create policy "devices read" on public.gps_devices for select to authenticated using(public.is_org_member(organization_id));
create policy "devices manage" on public.gps_devices for all to authenticated using(public.has_org_role(organization_id,array['owner','admin']::public.organization_role[])) with check(public.has_org_role(organization_id,array['owner','admin']::public.organization_role[]));
create policy "assignments read" on public.vehicle_assignments for select to authenticated using(public.is_org_member(organization_id));
create policy "assignments manage" on public.vehicle_assignments for all to authenticated using(public.has_org_role(organization_id,array['owner','admin','fleet_manager','dispatcher']::public.organization_role[])) with check(public.has_org_role(organization_id,array['owner','admin','fleet_manager','dispatcher']::public.organization_role[]));
create policy "positions read only" on public.vehicle_positions for select to authenticated using(public.is_org_member(organization_id));
create policy "current state read" on public.vehicle_current_state for select to authenticated using(public.is_org_member(organization_id));
create policy "trips read" on public.trips for select to authenticated using(public.is_org_member(organization_id));
create policy "trips manager update" on public.trips for update to authenticated using(public.has_org_role(organization_id,array['owner','admin','fleet_manager','dispatcher']::public.organization_role[])) with check(public.has_org_role(organization_id,array['owner','admin','fleet_manager','dispatcher']::public.organization_role[]));
create policy "geofences read" on public.geofences for select to authenticated using(public.is_org_member(organization_id));
create policy "geofences manage" on public.geofences for all to authenticated using(public.has_org_role(organization_id,array['owner','admin','fleet_manager']::public.organization_role[])) with check(public.has_org_role(organization_id,array['owner','admin','fleet_manager']::public.organization_role[]));
create policy "alerts read" on public.alerts for select to authenticated using(public.is_org_member(organization_id));
create policy "alerts acknowledge" on public.alerts for update to authenticated using(public.is_org_member(organization_id)) with check(public.is_org_member(organization_id));
create policy "maintenance read" on public.maintenance_records for select to authenticated using(public.is_org_member(organization_id));
create policy "maintenance manage" on public.maintenance_records for all to authenticated using(public.has_org_role(organization_id,array['owner','admin','fleet_manager']::public.organization_role[])) with check(public.has_org_role(organization_id,array['owner','admin','fleet_manager']::public.organization_role[]));
create policy "fuel read" on public.fuel_records for select to authenticated using(public.is_org_member(organization_id));
create policy "fuel manage" on public.fuel_records for all to authenticated using(public.has_org_role(organization_id,array['owner','admin','fleet_manager']::public.organization_role[])) with check(public.has_org_role(organization_id,array['owner','admin','fleet_manager']::public.organization_role[]));
create policy "consent read" on public.tracking_consents for select to authenticated using(public.is_org_member(organization_id));
create policy "driver records own consent" on public.tracking_consents for insert to authenticated with check(exists(select 1 from public.drivers d where d.id=driver_id and d.organization_id=organization_id and d.user_id=auth.uid()));
create policy "audit admins read" on public.audit_logs for select to authenticated using(public.has_org_role(organization_id,array['owner','admin']::public.organization_role[]));
-- Intentionally no client insert/update/delete policies on GPS telemetry or audit logs. Use trusted server-side ingestion.


-- Prevent an organization administrator from granting or escalating owner privileges.
create or replace function public.guard_membership_role_changes()
returns trigger language plpgsql security definer set search_path=public,auth as $$
declare actor_is_owner boolean; actor_is_admin boolean;
begin
 actor_is_owner := public.has_org_role(coalesce(new.organization_id,old.organization_id),array['owner']::public.organization_role[]);
 actor_is_admin := public.has_org_role(coalesce(new.organization_id,old.organization_id),array['admin']::public.organization_role[]);
 if actor_is_owner then
   if TG_OP='DELETE' then return old; else return new; end if;
 end if;
 if not actor_is_admin then raise exception 'Only organization owners or admins may manage memberships'; end if;
 if TG_OP='DELETE' then
   if old.role='owner' then raise exception 'Only an owner may remove an owner'; end if;
   return old;
 end if;
 if new.role='owner' or (TG_OP='UPDATE' and old.role='owner') then
   raise exception 'Only an owner may grant or change owner membership';
 end if;
 return new;
end; $$;
drop trigger if exists guard_membership_role_changes on public.organization_memberships;
create trigger guard_membership_role_changes
before insert or update or delete on public.organization_memberships
for each row execute function public.guard_membership_role_changes();
