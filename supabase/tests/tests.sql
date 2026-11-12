-- VEKTOR database tests: tenant isolation, roles, ingestion, trips, geofences, alerts.
-- Run with supabase/tests/run_tests.sh (local PostgreSQL) - any failed assertion aborts.

create table t_ctx (k text primary key, v uuid);
grant all on t_ctx to public;

create function t_c(p_k text) returns uuid language sql stable as $$ select v from t_ctx where k = p_k $$;
create function t_set(p_k text, p_v uuid) returns void language sql as $$
  insert into t_ctx values (p_k, p_v) on conflict (k) do update set v = excluded.v $$;
create function t_assert(p_cond boolean, p_msg text) returns void language plpgsql as $$
begin if p_cond is not true then raise exception 'ASSERTION FAILED: %', p_msg; end if; end $$;
create function t_login(p_user uuid) returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', p_user::text, true);
  execute 'set local role authenticated';
end $$;
create function t_service() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', true);
  execute 'set local role service_role';
end $$;
create function t_logout() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', true);
end $$;
-- run sql, require it to fail with a message containing p_frag
create function t_fails(p_sql text, p_frag text) returns void language plpgsql as $$
declare v_failed boolean := false;
begin
  begin
    execute p_sql;
  exception when others then
    v_failed := true;
    if sqlerrm not ilike '%' || p_frag || '%' then
      raise exception 'ASSERTION FAILED: "%" failed with "%" but expected "%"', p_sql, sqlerrm, p_frag;
    end if;
  end;
  if not v_failed then raise exception 'ASSERTION FAILED: expected failure (%) for: %', p_frag, p_sql; end if;
end $$;

insert into auth.users (id, email, raw_user_meta_data) values
  ('a1111111-1111-1111-1111-111111111111', 'alice@alpha.test', '{"full_name":"Alice Owner"}'),
  ('b2222222-2222-2222-2222-222222222222', 'bob@beta.test', '{"full_name":"Bob Owner"}'),
  ('c3333333-3333-3333-3333-333333333333', 'carol@alpha.test', '{"full_name":"Carol Driver"}'),
  ('d4444444-4444-4444-4444-444444444444', 'dave@alpha.test', '{"full_name":"Dave Analyst"}'),
  ('e5555555-5555-5555-5555-555555555555', 'eve@alpha.test', '{"full_name":"Eve Admin"}'),
  ('f6666666-6666-6666-6666-666666666666', 'frank@vektor.test', '{"full_name":"Frank Platform"}');

-- ============ 1. organisations, profiles, membership ============
do $$
declare a uuid := 'a1111111-1111-1111-1111-111111111111'; b uuid := 'b2222222-2222-2222-2222-222222222222';
        oa uuid; ob uuid; n int;
begin
  perform t_assert((select count(*) from public.user_profiles) = 6, 'profiles auto-created for every auth user');
  perform t_login(a); oa := public.create_organization('Alpha Logistics'); perform t_set('orgA', oa);
  perform t_login(b); ob := public.create_organization('Beta Haulage'); perform t_set('orgB', ob);
  perform t_logout();
  perform t_assert((select role from public.organization_memberships where organization_id = oa and user_id = a) = 'owner', 'creator is owner');
  perform t_assert((select status from public.subscription_accounts where organization_id = oa) = 'trialing', 'trial subscription created');

  perform t_login(a);
  select count(*) into n from public.organizations; perform t_assert(n = 1, 'alice sees only her organisation');
  select count(*) into n from public.subscription_accounts where organization_id = ob; perform t_assert(n = 0, 'alice cannot see beta subscription');
  perform t_fails('insert into public.organizations (name, slug) values (''x'', ''x'')', 'permission denied');
  perform t_fails('update public.organizations set status = ''suspended'' where id = ''' || oa || '''', 'permission denied');
  perform t_fails('update public.user_profiles set is_platform_admin = true where id = ''' || a || '''', 'permission denied');
  perform t_logout();
end $$;

-- ============ 2. tenant isolation on fleet tables ============
do $$
declare a uuid := 'a1111111-1111-1111-1111-111111111111'; b uuid := 'b2222222-2222-2222-2222-222222222222';
        oa uuid := t_c('orgA'); ob uuid := t_c('orgB'); va uuid; vb uuid; n int;
begin
  perform t_login(a);
  insert into public.vehicles (organization_id, registration_number, make, model, fuel_type)
    values (oa, 'AFA 1234', 'Toyota', 'Hilux', 'diesel') returning id into va;
  perform t_set('vA', va);
  perform t_login(b);
  insert into public.vehicles (organization_id, registration_number, make) values (ob, 'BEE 9999', 'Isuzu') returning id into vb;
  perform t_set('vB', vb);

  perform t_login(a);
  select count(*) into n from public.vehicles; perform t_assert(n = 1, 'alice sees only org A vehicles');
  perform t_fails('insert into public.vehicles (organization_id, registration_number) values (''' || ob || ''', ''HACK 1'')', 'row-level security');
  update public.vehicles set make = 'Hacked' where id = vb; get diagnostics n = row_count;
  perform t_assert(n = 0, 'alice cannot update org B vehicle');
  delete from public.vehicles where id = vb; get diagnostics n = row_count;
  perform t_assert(n = 0, 'alice cannot delete org B vehicle');
  perform t_fails('insert into public.vehicles (organization_id, registration_number) values (''' || oa || ''', ''afa 1234'')', 'duplicate key');

  -- composite FK stops cross-tenant references even when RLS would allow the insert
  perform t_fails('insert into public.gps_devices (organization_id, vehicle_id, imei) values (''' || oa || ''', ''' || vb || ''', ''999999999999999'')', 'foreign key');
  perform t_fails('insert into public.fuel_records (organization_id, vehicle_id, litres, total_cost) values (''' || oa || ''', ''' || vb || ''', 10, 10)', 'foreign key');

  -- telemetry tables are not client-writable
  perform t_fails('insert into public.vehicle_positions (organization_id, vehicle_id, geom, latitude, longitude, source, device_time) values (''' || oa || ''', ''' || va || ''', row(31,-17)::public.geography, -17, 31, ''hardware'', now())', 'permission denied');
  perform t_fails('insert into public.alerts (organization_id, type, title) values (''' || oa || ''', ''other'', ''fake'')', 'permission denied');
  perform t_fails('insert into public.audit_logs (organization_id, action, entity) values (''' || oa || ''', ''x'', ''y'')', 'permission denied');
  perform t_logout();

  perform t_assert((select count(*) from public.audit_logs where organization_id = oa and entity = 'vehicles') >= 1, 'vehicle creation audited');
  perform t_login(b);
  select count(*) into n from public.audit_logs where organization_id = oa; perform t_assert(n = 0, 'bob cannot read org A audit log');
  perform t_logout();
end $$;

-- ============ 3. team, roles and invitations ============
do $$
declare a uuid := 'a1111111-1111-1111-1111-111111111111'; b uuid := 'b2222222-2222-2222-2222-222222222222';
        c uuid := 'c3333333-3333-3333-3333-333333333333'; d uuid := 'd4444444-4444-4444-4444-444444444444';
        e uuid := 'e5555555-5555-5555-5555-555555555555';
        oa uuid := t_c('orgA'); va uuid := t_c('vA'); tok uuid; n int; drv1 uuid; drv2 uuid;
begin
  perform t_login(a);
  insert into public.drivers (organization_id, full_name, phone, email) values (oa, 'Carol Driver', '+263771000001', 'carol@alpha.test') returning id into drv1;
  insert into public.drivers (organization_id, full_name, phone) values (oa, 'Other Driver', '+263771000002') returning id into drv2;
  perform t_set('drvCarol', drv1); perform t_set('drvOther', drv2);

  tok := public.invite_member(oa, 'carol@alpha.test', 'driver');
  perform t_login(c); perform public.accept_invitation(tok);
  perform t_login(a); tok := public.invite_member(oa, 'dave@alpha.test', 'analyst');
  perform t_login(d); perform public.accept_invitation(tok);
  perform t_login(a); tok := public.invite_member(oa, 'eve@alpha.test', 'admin');
  perform t_login(e); perform public.accept_invitation(tok);

  -- invitation can't be accepted by the wrong person, or twice
  perform t_login(a); tok := public.invite_member(oa, 'someone@else.test', 'dispatcher');
  perform t_login(b); perform t_fails('select public.accept_invitation(''' || tok || ''')', 'invitation_email_mismatch');
  perform t_login(a); perform t_fails('select public.invite_member(''' || oa || ''', ''x@y.test'', ''owner'')', 'cannot_invite_owner');

  perform t_logout();
  perform t_assert((select user_id from public.drivers where id = drv1) = c, 'accepting driver invite links the driver record');

  -- admin limits
  perform t_login(e);
  perform t_fails('select public.invite_member(''' || oa || ''', ''z@z.test'', ''admin'')', 'forbidden_role');
  perform t_fails('select public.set_member_role_status(''' || oa || ''', ''' || a || ''', ''analyst'', null)', 'cannot_modify_owner');
  perform public.set_member_role_status(oa, d, 'dispatcher', null);
  perform t_assert((select role from public.organization_memberships where organization_id = oa and user_id = d) = 'dispatcher', 'admin can change analyst to dispatcher');
  perform public.set_member_role_status(oa, d, 'analyst', null);

  -- analyst is read-only
  perform t_login(d);
  select count(*) into n from public.vehicles; perform t_assert(n = 1, 'analyst can read vehicles');
  perform t_fails('insert into public.vehicles (organization_id, registration_number) values (''' || oa || ''', ''NEW 1'')', 'row-level security');
  perform t_fails('select public.assign_driver(''' || va || ''', ''' || drv1 || ''')', 'forbidden');
  select count(*) into n from public.audit_logs; perform t_assert(n = 0, 'analyst cannot read audit log');
  select count(*) into n from public.organization_invitations; perform t_assert(n = 0, 'analyst cannot read invitations');

  -- driver sees nothing until assigned, then only their vehicle and own driver row
  perform t_login(c);
  select count(*) into n from public.vehicles; perform t_assert(n = 0, 'unassigned driver sees no vehicles');
  perform t_login(a); perform public.assign_driver(va, drv1);
  perform t_login(c);
  select count(*) into n from public.vehicles; perform t_assert(n = 1, 'assigned driver sees assigned vehicle');
  select count(*) into n from public.drivers; perform t_assert(n = 1, 'driver sees only their own driver record');
  select count(*) into n from public.gps_devices; perform t_assert(n = 0, 'driver cannot list GPS devices');
  select count(*) into n from public.alerts; perform t_assert(n = 0, 'driver cannot see fleet alerts');
  perform t_fails('insert into public.vehicles (organization_id, registration_number) values (''' || oa || ''', ''DRV 1'')', 'row-level security');
  perform t_logout();

  -- reassigning closes the previous assignment
  perform t_login(a); perform public.assign_driver(va, drv2); perform t_logout();
  perform t_assert((select count(*) from public.vehicle_assignments where vehicle_id = va and unassigned_at is null) = 1, 'one active assignment per vehicle');
  perform t_login(c);
  select count(*) into n from public.vehicles; perform t_assert(n = 0, 'driver loses access when unassigned');
  perform t_login(a); perform public.assign_driver(va, drv1); perform t_logout();
end $$;

-- ============ 4. hardware ingestion, trips, current state ============
do $$
declare a uuid := 'a1111111-1111-1111-1111-111111111111'; c uuid := 'c3333333-3333-3333-3333-333333333333';
        oa uuid := t_c('orgA'); va uuid := t_c('vA'); t0 timestamptz := now() - interval '60 minutes';
        lat0 double precision := -17.8292; lon0 double precision := 31.0522; id1 bigint; id2 bigint; n int; km numeric;
begin
  perform t_login(a);
  insert into public.gps_devices (organization_id, vehicle_id, manufacturer, model, imei)
    values (oa, va, 'Teltonika', 'FMC920', '860000000000001');
  perform t_fails('select public.ingest_hardware_position(''860000000000001'', -17.8, 31.0, 10, 0, true, now())', 'permission denied');
  perform t_logout();

  perform t_service();
  perform t_fails('select public.ingest_hardware_position(''000000000000000'', -17.8, 31.0, 10)', 'unknown_device');
  perform t_fails('select public.ingest_hardware_position(''860000000000001'', 95, 31.0, 10)', 'invalid_coordinates');

  id1 := public.ingest_hardware_position('860000000000001', lat0, lon0, 0, 0, true, t0);
  perform t_assert(id1 is not null, 'first position stored');
  perform t_assert((select count(*) from public.trips where vehicle_id = va) = 0, 'no trip while stationary');
  perform t_assert((select motion_state from public.vehicle_current_state where vehicle_id = va) = 'idle', 'ignition on + speed 0 = idle');

  perform public.ingest_hardware_position('860000000000001', lat0 + 0.005, lon0, 30, 0, true, t0 + interval '1 minute');
  perform t_assert((select count(*) from public.trips where vehicle_id = va and status = 'in_progress') = 1, 'trip starts at >= 8 km/h');
  perform public.ingest_hardware_position('860000000000001', lat0 + 0.010, lon0, 40, 0, true, t0 + interval '2 minutes');
  perform public.ingest_hardware_position('860000000000001', lat0 + 0.015, lon0, 40, 0, true, t0 + interval '3 minutes');
  select distance_km into km from public.trips where vehicle_id = va;
  perform t_assert(km between 1.0 and 1.3, format('trip distance ~1.1 km, got %s', km));

  -- duplicate message must not create a second row or disturb the trip
  id2 := public.ingest_hardware_position('860000000000001', lat0 + 0.015, lon0, 40, 0, true, t0 + interval '3 minutes');
  perform t_assert(id2 is null, 'duplicate device_time ignored');
  select count(*) into n from public.vehicle_positions where vehicle_id = va; perform t_assert(n = 4, 'four distinct positions so far');

  -- out-of-order fix is history only
  perform public.ingest_hardware_position('860000000000001', lat0 - 0.5, lon0, 50, 0, true, t0 + interval '30 seconds');
  perform t_assert((select latitude from public.vehicle_current_state where vehicle_id = va) = lat0 + 0.015, 'older fix does not overwrite current state');
  select count(*) into n from public.vehicle_positions where vehicle_id = va; perform t_assert(n = 5, 'older fix kept as history');

  -- stopping: trip must NOT end before 10 minutes below 3 km/h
  perform public.ingest_hardware_position('860000000000001', lat0 + 0.015, lon0, 0, 0, false, t0 + interval '4 minutes');
  perform public.ingest_hardware_position('860000000000001', lat0 + 0.015, lon0, 1, 0, false, t0 + interval '9 minutes');
  perform t_assert((select status from public.trips where vehicle_id = va) = 'in_progress', 'trip still open after 5 minutes stopped');
  perform public.ingest_hardware_position('860000000000001', lat0 + 0.015, lon0, 0, 0, false, t0 + interval '15 minutes');
  perform t_assert((select status from public.trips where vehicle_id = va) = 'completed', 'trip completes after 10 minutes below 3 km/h');
  perform t_assert((select ended_at from public.trips where vehicle_id = va) = t0 + interval '4 minutes', 'trip ends when the vehicle stopped');
  perform t_assert((select motion_state from public.vehicle_current_state where vehicle_id = va) = 'stopped', 'ignition off = stopped');

  -- staleness is judged from the age of the last fix, never from registration
  perform t_assert((select connection_state from public.vehicle_live_status where vehicle_id = va) = 'offline', 'old fix is labelled offline');
  perform public.ingest_hardware_position('860000000000001', lat0, lon0, 0, 0, true, now());
  perform t_assert((select connection_state from public.vehicle_live_status where vehicle_id = va) = 'live', 'fresh fix is live');
  perform t_assert((select last_communication_at from public.gps_devices where imei = '860000000000001') > now() - interval '1 minute', 'device last communication updated');
  perform t_logout();

  -- readers
  perform t_login(a);
  select count(*) into n from public.vehicle_positions; perform t_assert(n >= 6, 'owner reads positions');
  perform t_login(c);
  select count(*) into n from public.vehicle_positions; perform t_assert(n >= 6, 'assigned driver reads their vehicle positions');
  select count(*) into n from public.trips; perform t_assert(n = 1, 'driver sees trips where they are the driver');
  perform t_logout();
end $$;

-- ============ 5. geofences and alerts ============
do $$
declare a uuid := 'a1111111-1111-1111-1111-111111111111'; d uuid := 'd4444444-4444-4444-4444-444444444444';
        c uuid := 'c3333333-3333-3333-3333-333333333333';
        oa uuid := t_c('orgA'); va uuid := t_c('vA'); gf uuid; n int; al uuid;
        lat0 double precision := -17.8292; lon0 double precision := 31.0522;
begin
  perform t_login(d);
  perform t_fails('select public.upsert_geofence(''' || oa || ''', null, ''Nope'', ''depot'', ''circle'', -17.8, 31.0, 200)', 'forbidden');
  perform t_login(a);
  gf := public.upsert_geofence(oa, null, 'Main Depot', 'depot', 'circle', lat0, lon0, 300);
  perform t_fails('select public.upsert_geofence(''' || oa || ''', null, ''Bad'', ''depot'', ''circle'', -17.8, 31.0, -5)', 'invalid_circle');
  perform t_logout();

  perform t_service();
  -- first fix inside: baseline only, no alert
  perform public.ingest_hardware_position('860000000000001', lat0, lon0, 0, 0, true, now() + interval '1 minute');
  perform t_assert((select count(*) from public.alerts where type like 'geofence%') = 0, 'baseline observation raises no alert');
  -- leave the depot (~1.1 km north)
  perform public.ingest_hardware_position('860000000000001', lat0 + 0.010, lon0, 0, 0, true, now() + interval '2 minutes');
  perform t_assert((select count(*) from public.alerts where type = 'geofence_exit') = 1, 'exit alert raised');
  -- same side again: no duplicate
  perform public.ingest_hardware_position('860000000000001', lat0 + 0.011, lon0, 0, 0, true, now() + interval '2 minutes 30 seconds');
  perform t_assert((select count(*) from public.alerts where type = 'geofence_exit') = 1, 'no duplicate exit alert');
  -- return
  perform public.ingest_hardware_position('860000000000001', lat0, lon0, 0, 0, true, now() + interval '3 minutes');
  perform t_assert((select count(*) from public.alerts where type = 'geofence_entry') = 1, 'entry alert raised');
  perform t_assert((select count(*) from public.geofence_events where geofence_id = gf) = 2, 'geofence history recorded');
  perform t_assert((select count(*) from public.notifications) = 0, 'info alerts do not notify');

  -- overspeed
  perform t_logout();
  perform t_login(a); update public.vehicles set speed_limit_kmh = 50 where id = va; perform t_service();
  perform public.ingest_hardware_position('860000000000001', lat0, lon0, 80, 0, true, now() + interval '3 minutes 30 seconds');
  perform public.ingest_hardware_position('860000000000001', lat0, lon0, 85, 0, true, now() + interval '4 minutes');
  perform t_assert((select count(*) from public.alerts where type = 'overspeed') = 1, 'overspeed alert is de-duplicated');
  perform t_assert((select count(*) from public.notifications) >= 1, 'warning alerts notify managers');
  perform t_logout();

  -- visibility and workflow
  perform t_login(d);
  select count(*) into n from public.alerts; perform t_assert(n >= 3, 'analyst can read alerts');
  update public.alerts set status = 'acknowledged' where type = 'overspeed'; get diagnostics n = row_count;
  perform t_assert(n = 0, 'analyst cannot acknowledge alerts');
  perform t_login(c);
  select count(*) into n from public.alerts; perform t_assert(n = 0, 'driver cannot read alerts');
  select count(*) into n from public.notifications; perform t_assert(n = 0, 'driver has no manager notifications');
  perform t_login(a);
  select id into al from public.alerts where type = 'overspeed' limit 1;
  update public.alerts set status = 'acknowledged', acknowledged_by = a, acknowledged_at = now() where id = al;
  perform t_assert((select status from public.alerts where id = al) = 'acknowledged', 'owner can acknowledge');
  perform t_fails('update public.alerts set title = ''tampered'' where id = ''' || al || '''', 'permission denied');
  perform t_logout();
end $$;

-- ============ 6. offline detection ============
do $$
declare oa uuid := t_c('orgA'); va uuid := t_c('vA'); r jsonb;
begin
  update public.gps_devices set last_communication_at = now() - interval '3 hours' where imei = '860000000000001';
  perform t_service();
  r := public.run_scheduled_checks();
  perform t_assert((r ->> 'offline_alerts')::int = 1, 'offline alert created');
  r := public.run_scheduled_checks();
  perform t_assert((r ->> 'offline_alerts')::int = 0, 'offline alert not duplicated');
  perform public.ingest_hardware_position('860000000000001', -17.8292, 31.0522, 0, 0, true, now() + interval '4 minutes 30 seconds');
  perform t_assert((select status from public.alerts where type = 'device_offline') = 'resolved', 'offline alert resolves when device reports');
  perform t_logout();

  -- maintenance reminders
  insert into public.maintenance_records (organization_id, vehicle_id, maintenance_type, service_date, status)
    values (oa, va, 'Oil change', current_date + 3, 'scheduled');
  perform t_service();
  r := public.run_scheduled_checks();
  perform t_assert((r ->> 'maintenance_alerts')::int = 1, 'maintenance due alert created');
  r := public.run_scheduled_checks();
  perform t_assert((r ->> 'maintenance_alerts')::int = 0, 'maintenance alert not duplicated');
  perform t_logout();
end $$;

-- ============ 7. smartphone tracking and consent ============
do $$
declare a uuid := 'a1111111-1111-1111-1111-111111111111'; c uuid := 'c3333333-3333-3333-3333-333333333333';
        d uuid := 'd4444444-4444-4444-4444-444444444444'; va uuid := t_c('vA'); n int; id1 bigint;
begin
  perform t_login(c);
  perform t_fails('select public.ingest_phone_position(-17.83, 31.05, 0)', 'consent_required');
  perform public.set_tracking_consent(true, 'v1');
  id1 := public.ingest_phone_position(-17.83, 31.05, 5, 90, 12, now() - interval '30 seconds');
  perform t_assert(id1 is not null, 'phone position accepted after consent');
  n := public.ingest_phone_positions('[{"latitude":-17.83,"longitude":31.05,"speed_kmh":0,"device_time":"2020-01-01T10:00:00Z"},{"latitude":-17.83,"longitude":31.05,"speed_kmh":0,"device_time":"2020-01-01T10:00:00Z"}]'::jsonb);
  perform t_assert(n = 1, 'batch ingest de-duplicates');
  perform t_logout();
  perform t_assert((select source from public.vehicle_positions where id = id1) = 'smartphone', 'stored with smartphone source');
  perform t_assert((select driver_id from public.vehicle_positions where id = id1) = t_c('drvCarol'), 'stored against the signed-in driver');

  perform t_login(a);
  select count(*) into n from public.driver_consent_status where consented; perform t_assert(n = 1, 'manager can see consent status');
  perform t_login(c);
  perform public.set_tracking_consent(false);
  perform t_fails('select public.ingest_phone_position(-17.83, 31.05, 0)', 'consent_required');
  perform t_login(d);
  perform t_fails('select public.set_tracking_consent(true)', 'not_a_driver');
  perform t_fails('select public.ingest_phone_position(-17.83, 31.05, 0)', 'no_assignment');
  perform t_logout();
end $$;

-- ============ 8. subscription limits ============
do $$
declare a uuid := 'a1111111-1111-1111-1111-111111111111'; oa uuid := t_c('orgA'); i int;
begin
  perform t_login(a);
  for i in 2..5 loop
    insert into public.vehicles (organization_id, registration_number) values (oa, 'LIM ' || i);
  end loop;
  perform t_fails('insert into public.vehicles (organization_id, registration_number) values (''' || oa || ''', ''LIM 6'')', 'vehicle_limit_reached');
  perform t_logout();
end $$;

-- ============ 9. dashboard, platform admin, suspension ============
do $$
declare a uuid := 'a1111111-1111-1111-1111-111111111111'; b uuid := 'b2222222-2222-2222-2222-222222222222';
        f uuid := 'f6666666-6666-6666-6666-666666666666'; oa uuid := t_c('orgA'); ob uuid := t_c('orgB');
        s jsonb; n int;
begin
  perform t_login(a); s := public.dashboard_summary(oa);
  perform t_assert((s ->> 'total_vehicles')::int = 5, 'dashboard counts vehicles');
  perform t_assert((s ->> 'total_drivers')::int = 2, 'dashboard counts drivers');
  perform t_assert((s ->> 'open_alerts')::int >= 1, 'dashboard counts open alerts');
  perform t_login(b); s := public.dashboard_summary(oa);
  perform t_assert((s ->> 'total_vehicles')::int = 0, 'dashboard for another organisation shows nothing');
  perform t_fails('select * from public.platform_overview()', 'forbidden');
  perform t_logout();

  update public.user_profiles set is_platform_admin = true where id = f;
  perform t_login(f);
  select count(*) into n from public.platform_overview(); perform t_assert(n = 2, 'platform admin lists organisations');
  select count(*) into n from public.vehicles; perform t_assert(n = 0, 'platform admin is not an implicit member of tenant fleets');
  perform public.platform_set_org_status(ob, 'suspended');
  perform t_login(b);
  select count(*) into n from public.vehicles; perform t_assert(n = 0, 'suspended organisation loses data access');
  perform t_fails('insert into public.vehicles (organization_id, registration_number) values (''' || ob || ''', ''SUS 1'')', 'row-level security');
  perform t_assert((select count(*) from public.organization_memberships where user_id = b) = 1, 'user can still see own membership');
  perform t_login(f); perform public.platform_set_org_status(ob, 'active'); perform t_logout();
end $$;

-- ============ 10. plan change request ============
do $$
declare a uuid := 'a1111111-1111-1111-1111-111111111111'; e uuid := 'e5555555-5555-5555-5555-555555555555'; oa uuid := t_c('orgA');
begin
  perform t_login(e); perform t_fails('select public.request_plan_change(''' || oa || ''', ''fleet'')', 'forbidden');
  perform t_login(a); perform public.request_plan_change(oa, 'fleet');
  perform t_assert((select count(*) from public.billing_events where organization_id = oa) = 1, 'plan request recorded');
  perform t_fails('select public.request_plan_change(''' || oa || ''', ''nonsense'')', 'unknown_plan');
  perform t_logout();
end $$;

select 'database tests complete' as result;
