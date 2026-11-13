-- Remove redundant permissive SELECT policies while preserving existing write permissions.
drop policy if exists "membership admin" on public.organization_memberships;
create policy "membership insert" on public.organization_memberships for insert to authenticated with check (public.has_org_role(organization_id,array['owner','admin']::public.organization_role[]));
create policy "membership update" on public.organization_memberships for update to authenticated using (public.has_org_role(organization_id,array['owner','admin']::public.organization_role[])) with check (public.has_org_role(organization_id,array['owner','admin']::public.organization_role[]));
create policy "membership delete" on public.organization_memberships for delete to authenticated using (public.has_org_role(organization_id,array['owner','admin']::public.organization_role[]));

drop policy if exists "vehicles manage" on public.vehicles;
create policy "vehicles insert" on public.vehicles for insert to authenticated with check (public.has_org_role(organization_id,array['owner','admin','fleet_manager']::public.organization_role[]));
create policy "vehicles update" on public.vehicles for update to authenticated using (public.has_org_role(organization_id,array['owner','admin','fleet_manager']::public.organization_role[])) with check (public.has_org_role(organization_id,array['owner','admin','fleet_manager']::public.organization_role[]));
create policy "vehicles delete" on public.vehicles for delete to authenticated using (public.has_org_role(organization_id,array['owner','admin','fleet_manager']::public.organization_role[]));

drop policy if exists "drivers manage" on public.drivers;
create policy "drivers insert" on public.drivers for insert to authenticated with check (public.has_org_role(organization_id,array['owner','admin','fleet_manager','dispatcher']::public.organization_role[]));
create policy "drivers update" on public.drivers for update to authenticated using (public.has_org_role(organization_id,array['owner','admin','fleet_manager','dispatcher']::public.organization_role[])) with check (public.has_org_role(organization_id,array['owner','admin','fleet_manager','dispatcher']::public.organization_role[]));
create policy "drivers delete" on public.drivers for delete to authenticated using (public.has_org_role(organization_id,array['owner','admin','fleet_manager','dispatcher']::public.organization_role[]));

drop policy if exists "devices manage" on public.gps_devices;
create policy "devices insert" on public.gps_devices for insert to authenticated with check (public.has_org_role(organization_id,array['owner','admin']::public.organization_role[]));
create policy "devices update" on public.gps_devices for update to authenticated using (public.has_org_role(organization_id,array['owner','admin']::public.organization_role[])) with check (public.has_org_role(organization_id,array['owner','admin']::public.organization_role[]));
create policy "devices delete" on public.gps_devices for delete to authenticated using (public.has_org_role(organization_id,array['owner','admin']::public.organization_role[]));

drop policy if exists "assignments manage" on public.vehicle_assignments;
create policy "assignments insert" on public.vehicle_assignments for insert to authenticated with check (public.has_org_role(organization_id,array['owner','admin','fleet_manager','dispatcher']::public.organization_role[]));
create policy "assignments update" on public.vehicle_assignments for update to authenticated using (public.has_org_role(organization_id,array['owner','admin','fleet_manager','dispatcher']::public.organization_role[])) with check (public.has_org_role(organization_id,array['owner','admin','fleet_manager','dispatcher']::public.organization_role[]));
create policy "assignments delete" on public.vehicle_assignments for delete to authenticated using (public.has_org_role(organization_id,array['owner','admin','fleet_manager','dispatcher']::public.organization_role[]));

drop policy if exists "geofences manage" on public.geofences;
create policy "geofences insert" on public.geofences for insert to authenticated with check (public.has_org_role(organization_id,array['owner','admin','fleet_manager']::public.organization_role[]));
create policy "geofences update" on public.geofences for update to authenticated using (public.has_org_role(organization_id,array['owner','admin','fleet_manager']::public.organization_role[])) with check (public.has_org_role(organization_id,array['owner','admin','fleet_manager']::public.organization_role[]));
create policy "geofences delete" on public.geofences for delete to authenticated using (public.has_org_role(organization_id,array['owner','admin','fleet_manager']::public.organization_role[]));

drop policy if exists "maintenance manage" on public.maintenance_records;
create policy "maintenance insert" on public.maintenance_records for insert to authenticated with check (public.has_org_role(organization_id,array['owner','admin','fleet_manager']::public.organization_role[]));
create policy "maintenance update" on public.maintenance_records for update to authenticated using (public.has_org_role(organization_id,array['owner','admin','fleet_manager']::public.organization_role[])) with check (public.has_org_role(organization_id,array['owner','admin','fleet_manager']::public.organization_role[]));
create policy "maintenance delete" on public.maintenance_records for delete to authenticated using (public.has_org_role(organization_id,array['owner','admin','fleet_manager']::public.organization_role[]));

drop policy if exists "fuel manage" on public.fuel_records;
create policy "fuel insert" on public.fuel_records for insert to authenticated with check (public.has_org_role(organization_id,array['owner','admin','fleet_manager']::public.organization_role[]));
create policy "fuel update" on public.fuel_records for update to authenticated using (public.has_org_role(organization_id,array['owner','admin','fleet_manager']::public.organization_role[])) with check (public.has_org_role(organization_id,array['owner','admin','fleet_manager']::public.organization_role[]));
create policy "fuel delete" on public.fuel_records for delete to authenticated using (public.has_org_role(organization_id,array['owner','admin','fleet_manager']::public.organization_role[]));
