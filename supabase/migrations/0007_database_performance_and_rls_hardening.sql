-- VEKTOR database hardening: cover foreign keys and optimize auth-dependent RLS checks.
-- All changes are additive or policy-equivalent; no application data is removed.

create index if not exists alerts_acknowledged_by_idx on public.alerts(acknowledged_by);
create index if not exists alerts_organization_id_idx on public.alerts(organization_id);
create index if not exists alerts_vehicle_org_idx on public.alerts(vehicle_id, organization_id);

create index if not exists audit_logs_actor_user_id_idx on public.audit_logs(actor_user_id);
create index if not exists audit_logs_organization_id_idx on public.audit_logs(organization_id);

create index if not exists drivers_organization_id_idx on public.drivers(organization_id);
create index if not exists drivers_user_id_idx on public.drivers(user_id);

create index if not exists fuel_records_organization_id_idx on public.fuel_records(organization_id);
create index if not exists fuel_records_vehicle_org_idx on public.fuel_records(vehicle_id, organization_id);

create index if not exists geofences_organization_id_idx on public.geofences(organization_id);
create index if not exists gps_devices_vehicle_org_idx on public.gps_devices(vehicle_id, organization_id);

create index if not exists maintenance_records_organization_id_idx on public.maintenance_records(organization_id);
create index if not exists maintenance_records_vehicle_org_idx on public.maintenance_records(vehicle_id, organization_id);

create index if not exists organizations_created_by_idx on public.organizations(created_by);

create index if not exists tracking_consents_driver_org_idx on public.tracking_consents(driver_id, organization_id);
create index if not exists tracking_consents_organization_id_idx on public.tracking_consents(organization_id);

create index if not exists trips_driver_org_idx on public.trips(driver_id, organization_id);
create index if not exists trips_organization_id_idx on public.trips(organization_id);
create index if not exists trips_vehicle_org_idx on public.trips(vehicle_id, organization_id);

create index if not exists vehicle_assignments_driver_org_idx on public.vehicle_assignments(driver_id, organization_id);
create index if not exists vehicle_assignments_organization_id_idx on public.vehicle_assignments(organization_id);
create index if not exists vehicle_assignments_vehicle_org_idx on public.vehicle_assignments(vehicle_id, organization_id);

create index if not exists vehicle_current_state_organization_id_idx on public.vehicle_current_state(organization_id);
create index if not exists vehicle_current_state_vehicle_org_idx on public.vehicle_current_state(vehicle_id, organization_id);

create index if not exists vehicle_geofence_state_geofence_id_idx on public.vehicle_geofence_state(geofence_id);
create index if not exists vehicle_geofence_state_organization_id_idx on public.vehicle_geofence_state(organization_id);
create index if not exists vehicle_geofence_state_vehicle_org_idx on public.vehicle_geofence_state(vehicle_id, organization_id);

create index if not exists vehicle_positions_gps_device_org_idx on public.vehicle_positions(gps_device_id, organization_id);
create index if not exists vehicle_positions_vehicle_org_idx on public.vehicle_positions(vehicle_id, organization_id);

-- Avoid per-row auth function re-evaluation in RLS policies.
drop policy if exists "own profile" on public.user_profiles;
create policy "own profile" on public.user_profiles
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "driver records own consent" on public.tracking_consents;
create policy "driver records own consent" on public.tracking_consents
  for insert to authenticated
  with check (
    exists (
      select 1
      from public.drivers d
      where d.id = tracking_consents.driver_id
        and d.organization_id = tracking_consents.organization_id
        and d.user_id = (select auth.uid())
    )
  );
