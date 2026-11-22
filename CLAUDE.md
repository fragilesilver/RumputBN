# RumputBN

Marketplace connecting grass-cutting services with customers in **Brunei**.
Customers outline their lawn on a satellite map; price is computed from area.
See `docs/PLAN.md` for the product plan and phases.

## Layout
- `web/` — Next.js 16 app (App Router, TypeScript, Tailwind v4). All commands run from here.
  - `src/lib/pricing.ts` — pricing engine (pure, BND). Change rates in `DEFAULT_PRICING` only.
  - `src/lib/geo.ts` — billable area from drawn shapes (Turf union/difference).
  - `src/components/QuoteMap.tsx` — MapLibre + Terra Draw map (client-only, loaded via `next/dynamic`).
  - `src/components/QuoteTool.tsx` — quote page UI and state.
  - `src/app/api/geocode/route.ts` — Nominatim proxy, Brunei only.

## Commands (in `web/`)
- `npm run dev` — dev server (predev copies MapLibre's worker into `public/`)
- `npm test` — Vitest unit tests
- `npm run lint`, `npx tsc --noEmit`, `npm run build`

## Conventions
- Money is BND; format with `formatBND`. Keep pricing logic pure and covered by tests.
- Any server-side job creation must recompute the quote with `calculateQuote`, never trust client totals.
- MapLibre v6 uses named exports only and needs `setWorkerUrl` (see `scripts/copy-maplibre-worker.mjs`).
- npm installs may need `--legacy-peer-deps` (npm 10 arborist bug seen with vitest).
- UI copy is English for now; a Malay toggle is planned — keep user-facing strings in components easy to extract.
