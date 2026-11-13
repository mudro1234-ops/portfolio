# VEKTOR deployment environment setup

Add credentials in **Vercel → the VEKTOR project → Settings → Environment Variables**. Add each variable to **Production, Preview and Development** where the feature should be available, then redeploy the relevant environment. Do not commit secrets to GitHub or put private keys in variables prefixed with `NEXT_PUBLIC_`.

## Core database and authentication

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL. Safe to expose to the browser. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase publishable/anon key used by the browser and server session clients. Safe to expose when RLS is correctly configured. |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes for current GPS/mobile ingestion | Server-only privileged key used by the mobile-position and Traccar webhook endpoints. Never expose it to the browser. |
| `NEXT_PUBLIC_APP_URL` | Recommended | Canonical deployed VEKTOR URL, including `https://`; used to build invitation redirect URLs. |

The system-admin workspace invitation endpoint accepts `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY`. The current mobile-position and Traccar webhook routes specifically require `SUPABASE_SERVICE_ROLE_KEY`, so add that variable if those features are needed.

## Maps and GPS

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | For maps | Mapbox public token used to render the map in the browser. Use a restricted public token with only the required map styles/tiles scopes. |
| `TRACCAR_WEBHOOK_SECRET` | For Traccar ingestion | A long random secret shared between the VEKTOR webhook and the Traccar HTTP event-forwarding configuration. |

After setting the GPS variables, configure Traccar to send position events to:

`https://YOUR-VEKTOR-DOMAIN/api/traccar/webhook`

Send the shared secret in the `x-traccar-token` HTTP header. Register each physical device in VEKTOR and map its Traccar device ID to the correct vehicle. A tracker, SIM/data plan, Traccar server, compatible protocol and forwarding configuration are also required; an API key alone does not provide GPS positions.

## AI assistant (configure at least one provider)

| Variable | Required | Purpose |
| --- | --- | --- |
| `GEMINI_API_KEY` | Optional provider | Google Gemini server-side API key. |
| `GROQ_API_KEY` | Optional provider | Groq server-side API key. |
| `OPENROUTER_API_KEY` | Optional provider | OpenRouter server-side API key. |

VEKTOR tries configured providers in this order: Gemini, Groq, then OpenRouter. Add one or more keys to enable fallback. Optional model overrides are `GEMINI_MODEL`, `GROQ_MODEL`, and `OPENROUTER_MODEL`; the application has defaults if these are omitted.

## Supabase Auth redirect URLs

In **Supabase Dashboard → Authentication → URL Configuration**, set the Site URL to the canonical production VEKTOR URL. Add the deployed production URL and each active preview deployment URL to the Redirect URLs allow-list, using the correct wildcard form supported by Supabase (for example, `https://YOUR-VEKTOR-DOMAIN/**`). Invitation emails must be allowed to return to `/auth/callback`.

## Safe setup checklist

1. Open Vercel and select the VEKTOR web project.
2. Open **Settings → Environment Variables**.
3. Add the exact variable names above, choose the environments, and save.
4. For every secret key, use Vercel's encrypted/sensitive value type where offered. Never use a `NEXT_PUBLIC_` prefix for service-role, AI-provider, or webhook secrets.
5. Open Supabase URL Configuration and allow the VEKTOR callback URLs.
6. Redeploy Preview first and test sign-in, workspace invitation, map rendering, GPS ingestion and AI fallback.
7. Only after Preview tests pass, deploy/merge to Production and repeat the checks.

**Never paste API keys into chat, source files, screenshots, or GitHub commits.** If a secret has been exposed, rotate it with its provider and update Vercel.
