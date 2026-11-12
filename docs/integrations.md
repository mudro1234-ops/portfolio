# Madrude integration setup

This repository contains the application-side integration endpoints. External services are not considered connected until their infrastructure and credentials are configured and a real end-to-end test succeeds.

## Vercel environment variables

Configure values in the Madrude Vercel project (Production, Preview and Development as appropriate). Never commit real credentials.

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser-safe Supabase publishable/anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only key used by trusted GPS ingestion routes |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Mapbox GL map rendering |
| `TRACCAR_WEBHOOK_SECRET` | Shared secret expected in `x-traccar-token` |
| `GEMINI_API_KEY`, `GROQ_API_KEY`, `OPENROUTER_API_KEY` | Optional server-side AI provider fallback |
| `GEMINI_MODEL`, `GROQ_MODEL`, `OPENROUTER_MODEL` | Optional model overrides |

The service-role key must never use a `NEXT_PUBLIC_` prefix and must never be added to the mobile app.

## Traccar GPS devices

1. Deploy and secure a Traccar server on a VPS; do not run the GPS server as a Vercel function.
2. Configure each physical tracker to send its protocol data to the Traccar server and confirm it appears in Traccar.
3. In Madrude, add a GPS device record and assign it to a vehicle. Set its provider device ID to the exact Traccar device ID.
4. Configure Traccar position forwarding in `/opt/traccar/conf/traccar.xml` (or your container-mounted config). Use JSON forwarding and a shared header:\n\n   ```xml\n   <entry key='forward.url'>https://YOUR_MADRude_DOMAIN/api/traccar/webhook</entry>\n   <entry key='forward.type'>json</entry>\n   <entry key='forward.header'>x-traccar-token: YOUR_TRACCAR_WEBHOOK_SECRET</entry>\n   <entry key='forward.retry.enable'>true</entry>\n   ```\n\n   Restart Traccar after changing the config. Traccar forwards decoded position JSON, including `deviceId`, `latitude`, `longitude`, `speed`, `course` and `fixTime`. Set the Madrude GPS device's `provider_device_id` to the numeric Traccar device ID (not just the device name). The webhook converts Traccar speed from knots to km/h.
5. Send a test position and confirm it appears in vehicle position history and current state. The map marks old fixes as stale; it does not present them as live.

The webhook accepts Traccar's forwarded position JSON. Only a registered, active device linked to a vehicle is accepted. Traccar's forwarder retries failed HTTP deliveries when enabled. Do not expose the webhook secret in device-facing configuration or client apps.

## Driver smartphone tracking

1. Create the driver's Supabase Auth account.
2. Link the driver's user ID to their driver record.
3. Create an active vehicle assignment for that driver.
4. Build and install the Expo app with `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` and `EXPO_PUBLIC_API_URL`.
5. The driver signs in, reads the disclosure, explicitly grants consent and starts foreground tracking. The server records consent and checks the driver, assignment and consent on every position.
6. The driver can stop tracking or withdraw consent. Background tracking is intentionally not enabled in this initial version.

## AI assistant

The assistant reads only the signed-in user's organization data using Supabase RLS and sends a bounded operational snapshot to the first configured provider that succeeds: Gemini, Groq, then OpenRouter. Configure keys server-side. Provider usage may incur charges.

## Still to configure before production use

- VPS deployment, TLS, firewall and backups for Traccar.
- GPS tracker SIM/data plans and device protocol configuration.
- Mapbox account/token and map loading test.
- Redis and a durable worker deployment for scheduled jobs/notifications.
- Payment gateway account, billing webhooks and reconciliation before charging customers.
- Mobile app signing, physical-device testing, privacy disclosures and app-store release.
- Monitoring, backups, restore test, incident response and security review.
