---
name: update-data
description: Refresh or backfill data/ snapshots locally and sanity-check them - run fetch_prices.mjs, validate schemas, recompute aggregates. Use when data is stale, missing, or a backfill is requested.
---

# Update / backfill price data

1. **Run the pipeline.** Default (yesterday…tomorrow): `node scripts/fetch_prices.mjs`.
   Backfill: `node scripts/fetch_prices.mjs --from YYYY-MM-DD --to YYYY-MM-DD`
   (dates are Europe/Riga local).
2. **Validate output** before trusting it:
   - newest `data/daily/*.json`: 24 entries per zone (23 on spring-DST day),
     hours unique 0–23, prices plausible (−50…600 EUR/MWh), zones LV/EE/LT all
     present;
   - `data/aggregates.json`: `updated_at` is now, matrix 7×24, `window_avg`
     not null.
   Quick check: `node -e "const d=JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')); console.log(d.date, Object.keys(d.zones), d.zones.LV.length)" data/daily/<date>.json`
3. **Rerun idempotency check**: run the same command again — `git status` must
   show no new changes.
4. **Report**: dates written/skipped (tomorrow unpublished is normal before
   ~15:30 Riga), aggregates freshness. Don't commit unless asked.
