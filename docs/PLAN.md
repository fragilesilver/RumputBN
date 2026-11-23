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

## Platform commission

The customer pays only the agreed job price. The platform's commission comes
out of the cutter's side:

```
customer pays  = agreed price           (e.g. B$45)
platform fee   = agreed price × 20%     (B$9)
cutter payout  = agreed price − fee     (B$36)
```

- Default **20%**, stored in the `platform_settings` table, so it can change
  without a deploy. Benchmarks: ride-hailing and delivery apps take ~20–30%,
  home-services marketplaces 15–25%.
- The rate is **copied onto each job when an offer is accepted**, so changing
  it never alters jobs already agreed.
- Cutters see their payout after the fee before they make an offer.
- Risk to watch: if the fee feels too high, cutters and repeat customers will
  arrange jobs directly by WhatsApp and skip the platform. Consider a lower
  rate for repeat bookings, or perks only the platform provides (guaranteed
  payment, insurance, ratings, a steady flow of jobs).

## Stack

| Layer | Choice |
|---|---|
| App | Next.js (App Router, TypeScript, Tailwind) — installable PWA later |
| Backend | Supabase: Postgres + PostGIS, Auth (email one-time codes), Storage later |
| Auth email | Supabase's built-in sender for testing only (2/hour); free SMTP (e.g. Brevo, Resend) for launch |
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

### Phase 2 — Accounts & booking ✅
- Email-code login/registration for customers and cutters (`/login`, `/onboarding`).
  Switched from SMS to keep it free. Users type a contact phone (Brunei format) at
  onboarding, editable in `/account`; it's unverified.
- Request a cutter from the quote; the drawing survives the sign-in detour.
- Server re-prices every request from the shapes (client totals ignored).
- Cutter service area: base pin + radius (`/cutter/setup`), PostGIS matching.
- Cutters see nearby open jobs with approximate location only; offer within
  the fair band (enforced in the database), see payout after commission.
- Customer compares offers, accepts one; price, 20% fee and payout locked in.
- Contact unlocked after booking: call, WhatsApp, directions.
- Status: open → assigned → in progress → done; customer can cancel.
- Schema + RLS in `supabase/migrations`, tested by `supabase/tests`.

Still to do from Phase 2:
- Notify cutters of new nearby jobs (SMS/WhatsApp/push). Today they see
  them when they open the app (the page refreshes every 20 s).
- Save properties so repeat customers don't redraw.
- Photos with the request.
- Rate-limit job requests per customer.

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

## Sign-in cost notes

- Email codes: free in Supabase. The built-in sender is limited to about 2 emails/hour
  and is meant for testing, so production needs custom SMTP. Free tiers: Brevo
  (~300/day), Resend (~3,000/month, 100/day; needs your own domain).
- SMS (removed): needs Twilio or similar; paid per message.
- Later: Google sign-in is free and fast on Android; worth adding.

## Open questions
- Is 20% the right commission for launch? (Configurable in `platform_settings`.)
- Cutter verification requirements.
- Imagery licence for commercial launch (Esri terms vs. MapTiler / Google Map Tiles).
- Payment providers available for a Brunei marketplace.
