# Madrude Driver mobile app

Expo / React Native driver app starter.

## Local setup
1. Install monorepo dependencies with `pnpm install`.
2. Configure the following Expo public variables in your local environment:
   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY` (publishable/anon key only)
   - `EXPO_PUBLIC_API_URL` (deployed Madrude web origin)
3. Run `pnpm --filter @madrude/mobile start`.

## Included
- Supabase email/password authentication.
- Explicit driver consent confirmation before tracking starts.
- Foreground GPS tracking while the app is open.
- Authenticated position submission to `/api/mobile/position`.
- Server verification of driver account, active assignment and active consent.

Background tracking is deliberately disabled in this first release until battery use, platform permissions, privacy disclosures and app-store compliance are tested. Never place the Supabase service-role key in this app.
