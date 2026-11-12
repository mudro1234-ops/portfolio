# Production operations checklist

## Before onboarding paying customers

- Keep Vercel Production, Preview and Development variables separate. Redeploy after every environment-variable change.
- Confirm the production deployment is built from the intended `main` commit.
- Turn on Supabase leaked-password protection and use a strong password policy.
- Review Supabase Security Advisor and Performance Advisor after each database migration.
- Keep service-role, payment, AI and webhook secrets server-only. Rotate any secret that has been exposed in logs or source.
- Configure Supabase database backups according to the project's plan and retention needs. For business-critical fleets, maintain an independent encrypted off-site `pg_dump` backup and perform a restore drill. A backup that has never been restored is not a tested recovery plan.
- Monitor Vercel function errors and deployment failures. Review Supabase Postgres/Auth/API logs and alert on repeated GPS webhook failures.
- Set retention and access rules for raw GPS positions; document the legal basis, purpose and retention period for driver location data.
- Use least-privilege team roles and periodically review workspace memberships and audit logs.
- Do not enable real billing until payment webhooks are signature-verified, idempotent, reconciled and tested with sandbox transactions.

## GPS acceptance test

1. Create a vehicle and an active driver.
2. Create an active vehicle assignment.
3. Register a GPS device with provider `traccar`, the exact Traccar numeric device ID and the assigned vehicle.
4. Confirm the Traccar server can deliver a test JSON position with `x-traccar-token`.
5. Confirm the position appears in `vehicle_positions` and `vehicle_current_state`.
6. Confirm old fixes are marked stale and out-of-order fixes do not replace a newer current position.
7. Drive a test route. Confirm a trip starts at the configured speed threshold, accumulates plausible distance, and completes after ten minutes of reported low speed.
8. Cross a geofence boundary. Confirm exactly one entry or exit alert per transition.

Trip distance is based on GPS point-to-point segments and intentionally ignores implausible segments over 2 km between consecutive fixes. Validate this against known routes before using it for billing, payroll or compliance.

## Mobile acceptance test

- Test on the intended Android/iOS physical devices, not only a simulator.
- Confirm sign-in, driver-to-user linking, active vehicle assignment and consent.
- Confirm location updates stop when the driver stops tracking or withdraws consent.
- Confirm location is not collected while signed out or without consent.
- Background tracking is not enabled in this initial app. Do not advertise continuous background tracking until separately implemented and tested.

## Known initial-release limitations

- GPS, Mapbox, AI, email invitations and payment integrations require customer-owned accounts and credentials.
- The mobile app is a foreground-tracking starter and still requires physical-device testing and app-store preparation.
- The trip automation is GPS-triggered; a vehicle that stops sending positions cannot be automatically closed until another fix arrives. Use a scheduled stale-trip reconciliation worker before relying on unattended fleet operations.
- Geofence entry/exit creates in-app alerts. Email, SMS and push delivery require a notification provider and worker.
- CSV reports export up to 1,000 rows per table. Date-range filters, scheduled delivery and PDF reports are not included yet.
- Subscription records and trial status exist, but payment collection, webhook reconciliation, invoice generation and automated plan enforcement are not activated.
