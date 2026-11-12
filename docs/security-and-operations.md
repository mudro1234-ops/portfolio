# Security and operations baseline

- PostgreSQL RLS is the tenant boundary; frontend filtering is not security.
- Membership and roles are organization-scoped. Validate membership for every tenant operation.
- Raw GPS telemetry is append-only and written only by trusted server-side ingestion.
- Never expose Supabase service-role or Traccar administrator credentials to clients.
- Smartphone tracking requires informed in-app consent as well as OS permission. Show tracking state and provide a stop action.
- Stale/missing GPS fixes must be shown as stale/offline, never live.
- AI tools are read-only by default and must query only authorized tenant data.
- Audit membership, vehicle assignment, device and billing changes.
- Configure secrets in hosting secret stores; do not commit real environment files.
- Define retention, backups, incident response and access logging before production.

This scaffold does not provision Supabase, Traccar, Mapbox, Redis, billing or hosting resources.
