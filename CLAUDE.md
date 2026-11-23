# RumputBN

Marketplace connecting grass-cutting services with customers in **Brunei**.
Customers outline their lawn on a satellite map; price is computed from area.
See `docs/PLAN.md` for the product plan and phases.

## Layout
- `supabase/` — Supabase project (deployed by Supabase's GitHub integration).
  - `migrations/` — schema, RLS, RPCs. Clients only SELECT; state changes go through
    SECURITY DEFINER functions (`make_offer`, `accept_offer`, `set_job_status`, …).
  - `tests/run.sh` — schema/RLS tests on plain Postgres + PostGIS (no Docker needed).
  - `config.toml` — local stack config. Sign-in is by **email code** (SMS is off: it costs money).
  - `templates/code.html` — sign-in email showing `{{ .Token }}`; mirror it in the hosted dashboard.
- `web/` — Next.js 16 app (App Router, TypeScript, Tailwind v4). App commands run from here.
  - `src/lib/pricing.ts` — pricing engine (pure, BND). Change rates in `DEFAULT_PRICING` only.
  - `src/lib/geo.ts` — billable area from drawn shapes (Turf union/difference).
  - `src/components/QuoteMap.tsx` — MapLibre + Terra Draw map (client-only, loaded via `next/dynamic`).
  - `src/components/QuoteTool.tsx` — quote page UI and state.
  - `src/app/api/geocode/route.ts` — Nominatim proxy, Brunei only.
  - `src/lib/job-request.ts` — validates a booking and recomputes area + price server-side.
  - `src/lib/supabase/` — `server.ts` (user session, RLS), `admin.ts` (secret key, job inserts only),
    `client.ts` (browser). `src/proxy.ts` refreshes the session (Next 16 renamed middleware → proxy).
  - `src/app/jobs/actions.ts` — server actions; `src/app/{login,onboarding,cutter/setup,jobs}` — pages.

## Local Supabase (repo root, needs Docker)
- `npx supabase start -x studio,imgproxy,edge-runtime,logflare,vector,supavisor,realtime,storage-api,postgres-meta`
- Sign-in emails land in Mailpit: http://127.0.0.1:54324 (API: `/api/v1/search?query=to:"a@b.c"`).
- Put the printed URL / publishable / secret keys in `web/.env.local`. `npx supabase db reset` re-applies migrations.

## Commands (in `web/`)
- `npm run dev` — dev server (predev copies MapLibre's worker into `public/`)
- `npm test` — Vitest unit tests
- `npm run lint`, `npx tsc --noEmit`, `npm run build`

## Conventions
- Money is BND; format with `formatBND`. Keep pricing logic pure and covered by tests.
- Any server-side job creation must recompute the quote with `calculateQuote`, never trust client totals.
- Commission comes out of the cutter's side. `splitEarnings()` in `pricing.ts` and `accept_offer()` in SQL
  must stay in sync (round the fee to cents; payout = price − fee).
- New tables: enable RLS, grant privileges explicitly (the project doesn't auto-grant), and
  `revoke execute ... from public, anon` on new functions. Add cases to `supabase/tests/marketplace_test.sql`.
- PostgREST upsert also updates the key column; use update-or-insert where clients have column grants.
- `profiles.phone` is typed in by the user (onboarding / `/account`), not verified; must match `^\+673\d{7}$`.
- Never edit an applied migration; add a new one.
- MapLibre v6 uses named exports only and needs `setWorkerUrl` (see `scripts/copy-maplibre-worker.mjs`).
- npm installs may need `--legacy-peer-deps` (npm 10 arborist bug seen with vitest).
- UI copy is English for now; a Malay toggle is planned — keep user-facing strings in components easy to extract.
