# VEKTOR v2 draft (work in progress)

Full web dashboard (apps/web) written against the schema produced by
`supabase/migrations/0007_vektor_v2_upgrade.sql`. It has NOT been compiled
(package installs were blocked in the build sandbox) and 0007 has NOT been
tested yet. Next step: move `apps/web` into the real `apps/web/src` folder,
run `pnpm install && pnpm typecheck`, then fix what the compiler reports.
