# RumputBN

Fair prices for grass cutting in Brunei. Customers draw their lawn on a satellite map and get an
instant, transparent quote; nearby cutters make offers within a fair range; the platform takes a
commission from the cutter's payout.

```bash
cd web
cp .env.example .env.local   # add Supabase keys for accounts & booking
npm install
npm run dev                  # http://localhost:3000
npm test
```

Database: `supabase/` (migrations, tests, local config). Product plan: [`docs/PLAN.md`](docs/PLAN.md).
