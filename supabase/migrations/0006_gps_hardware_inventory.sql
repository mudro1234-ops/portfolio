-- GPS hardware inventory and SIM/network metadata for African fleet deployments.
alter table public.gps_devices
 add column if not exists manufacturer text,
 add column if not exists model text,
 add column if not exists protocol text,
 add column if not exists network_operator text,
 add column if not exists sim_msisdn text,
 add column if not exists sim_iccid text,
 add column if not exists firmware_version text,
 add column if not exists installed_at date,
 add column if not exists installation_notes text,
 add column if not exists expected_interval_seconds integer not null default 30 check (expected_interval_seconds between 10 and 86400);
create unique index if not exists gps_devices_org_provider_device_uidx
 on public.gps_devices(organization_id,provider,provider_device_id)
 where provider_device_id is not null and provider_device_id <> '';
create index if not exists gps_devices_org_last_seen_idx
 on public.gps_devices(organization_id,last_seen_at desc);
