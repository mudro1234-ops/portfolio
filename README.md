# VEKTOR — Fleet Telemetry & Tracking

High-frequency telemetry, geolocation, fleet tracking and asset management for African fleet operators.

Multi-tenant fleet management SaaS foundation for physical GPS devices, consent-based smartphone tracking, company workspaces and fleet operations.

## Brand
- Product name: **VEKTOR**
- Descriptor: **Fleet Telemetry & Tracking**
- Positioning: **High-Frequency Telemetry & Geolocation for Fleet Tracking & Asset Management**
- Internal repository and service identifiers may retain their existing technical names until separately migrated.

## Current repository contents
- Next.js 15 web workspace scaffold with responsive fleet overview.
- Supabase Auth email/password sign-in and sign-up flow with protected routes.
- Supabase/PostgreSQL/PostGIS foundation migration with organization memberships, roles, fleet records, GPS telemetry, trips, geofences, alerts, maintenance, fuel, tracking consent and subscription records.
- Row Level Security policies for organization-scoped access.
- Mobile, worker and shared-contract implementation notes.
- Environment variable template with server-only secrets separated.

## Architecture and security
1. PostgreSQL is the source of truth; Traccar is a device gateway.
2. Tenant isolation is enforced in database RLS, not only frontend filtering.
3. Raw GPS positions are written by trusted server-side ingestion only.
4. Raw telemetry is separate from derived business trips.
5. Driver phone tracking requires explicit in-app consent plus operating-system permission.
6. AI is read-only by default and must use tenant-scoped data.
7. Stale GPS data must never be presented as live.

## Local setup
1. Install Node.js 20+ and pnpm 10+.
2. Create a Supabase project and enable PostGIS.
3. Apply the SQL migrations in supabase/migrations in numerical order to a fresh project.
4. Copy .env.example to .env.local and set the Supabase URL and anon key.
5. Run pnpm install, then pnpm dev.
6. Configure the Supabase Auth site URL and redirect URL for local and deployed web origins.

## Implementation status
This repository contains the application foundation and selected operational modules. Check docs/implementation-plan.md and docs/security-and-operations.md for deployment and integration requirements. A production GPS service requires a provisioned Traccar server and configured devices; the mobile starter currently tracks only while open in the foreground.
