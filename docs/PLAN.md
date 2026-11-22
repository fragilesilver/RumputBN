# RumputBN — Product Plan

Connect people in **Brunei** who need their grass cut with local grass cutters,
at a **fair, transparent price** based on the measured size of the lawn.

## How it works

1. Customer finds their home on a satellite map.
2. They outline the grass (and cut out the house, driveway, pool).
3. The app measures the area and shows a recommended price with a full breakdown.
4. Nearby cutters accept the job at that price, or counter-offer within a fair band (±15%).

## Pricing model (BND)

```
price = call-out fee
      + tiered rate × area (m²)        # cheaper per m² for bigger lawns
      × grass condition multiplier     # normal / long / overgrown
      × slope multiplier (optional)
      + clippings removal, edging (optional)
rounded to whole B$, with a minimum job price
```

The defaults live in `web/src/lib/pricing.ts` (`DEFAULT_PRICING`). They are
**placeholders** to be calibrated against real Brunei jobs and cutter feedback.

| Item | Default |
|---|---|
| Call-out fee | B$10 |
| Mowing: first 200 m² | B$0.10 / m² |
| Mowing: 200–1,000 m² | B$0.07 / m² |
| Mowing: above 1,000 m² | B$0.05 / m² |
| Long grass / overgrown | +25% / +60% on the mowing portion |
| Slope / uneven | +15% on the mowing portion |
| Remove clippings | B$0.02 / m², min B$8 |
| Edge trimming | B$8 flat |
| Minimum job | B$25 |
| Cutter counter-offer band | ±15% |
| Above 20,000 m² | Needs a site visit (no instant quote) |

## Stack

| Layer | Choice |
|---|---|
| App | Next.js (App Router, TypeScript, Tailwind) — installable PWA later |
| Backend | Supabase: Postgres + PostGIS, Auth (phone OTP), Realtime, Storage |
| Map | MapLibre GL + Terra Draw (drawing) + Turf.js (area, union/difference) |
| Imagery | Esri World Imagery by default (configurable via env) |
| Geocoding | OpenStreetMap Nominatim via `/api/geocode`, limited to Brunei |
| Payments | Phase 4 — Brunei options to evaluate (bank transfer/QR, card gateway) |

## Phases

### Phase 1 — Instant quote ✅ (this commit)
- Satellite map limited to Brunei, address search, "use my location".
- Draw grass areas, cut out non-grass areas, edit and delete shapes.
- Live area (union of grass − union of cut-outs, no double counting).
- Condition + extras, live price, breakdown, fair range.
- Unit tests for pricing and area maths.

### Phase 2 — Accounts & booking
- Supabase project, phone-number login (customers + cutters).
- Save a property (its shapes) so repeat quotes are one tap.
- Job request: date window, notes, photos.
- Cutter profile: service area (PostGIS radius/polygon), equipment, availability.
- Matching: notify cutters whose service area covers the job.
- Accept at recommended price, or counter-offer within the fair band.
- Server-side re-pricing on job creation (never trust client totals).

### Phase 3 — Doing the job
- Job status: accepted → on the way → in progress → done.
- Before/after photos, customer confirmation, ratings & reviews both ways.
- Simple disputes flow.

### Phase 4 — Money
- Online payment, platform commission, cutter payouts.
- Receipts.

### Later
- Recurring bookings (every 2/3/4 weeks) with discount.
- Bahasa Melayu / English toggle.
- Admin dashboard: tune pricing tiers, view jobs, verify cutters.
- Seasonal / monsoon demand pricing; calibrate rates from completed jobs.

## Open questions
- Commission rate, and who pays it (customer fee vs. cutter cut).
- Cutter verification requirements.
- Imagery licence for commercial launch (Esri terms vs. MapTiler / Google Map Tiles).
- Payment providers available for a Brunei marketplace.
