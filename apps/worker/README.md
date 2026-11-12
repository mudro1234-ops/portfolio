# Background worker

Reserved for Redis/BullMQ jobs: validate Traccar events, append immutable GPS telemetry, update current vehicle state, detect trips, and evaluate geofence/alert rules. Use server-only credentials and idempotent processing. Browser/mobile clients must never write raw telemetry.
