# PowerClock

Single-page radial visualization of Nord Pool day-ahead electricity prices
(zones LV/EE/LT). Data auto-updates daily via GitHub Actions; hosted on GitHub
Pages. Portfolio project — polish matters.

## Stack

React 18 + TypeScript + Vite · D3 (custom radial SVG charts) · Tailwind CSS v4
(+ CSS variables in `src/ui/theme.css`) · Vitest · Node 22 pipeline script
(no deps) · GitHub Actions + Pages.

## Architecture

- `scripts/fetch_prices.mjs` — pipeline CLI: Elering API → `data/daily/*.json`
  + `data/aggregates.json`. Pure logic lives in `scripts/lib/normalize.mjs`
  (imported by tests).
- `data/` — canonical JSON snapshots, committed by the cron workflow. Never
  edit by hand.
- `src/lib/` — `loader.ts` (fetch data JSON), `scales.ts` (color/price scales,
  unit conversion), `insights.ts` (pure insight functions).
- `src/charts/` — `ClockChart.tsx`, `WeekRing.tsx`, `YearSpiral.tsx` (D3-in-React:
  D3 computes geometry, React renders SVG elements).
- `src/ui/` — `Header.tsx`, `Card.tsx`, `Legend.tsx`, `theme.css` (design tokens).
- `.github/workflows/` — `data.yml` (daily cron 13:00 UTC), `deploy.yml` (Pages).
- Full module contracts: **SPEC.md**. New features: describe via SPEC_TEMPLATE.md
  first.

## Project rules

- **Timezone**: any "hour"/"date" in data and UI is Europe/Riga. Convert from
  UTC only via `Intl.DateTimeFormat` with `timeZone: 'Europe/Riga'`. Never
  hardcode +2/+3 offsets. This is the #1 bug source — test DST days.
- Prices stored in EUR/MWh; displayed in ct/kWh (÷10) — convert only via
  `toCtKwh()` in `src/lib/scales.ts`.
- Frontend never calls the Elering API — it reads committed `data/*.json` only.
- Pipeline script must be dependency-free Node and idempotent (same input →
  byte-identical output, no noisy commits).
- Radial chart rules: 00:00 at top, clockwise; value encoded by length + color
  (color-only is allowed solely for time-axis spirals); always a legend and an
  exact-value tooltip; negative prices must not break scales.
- Design tokens live in `theme.css` — no raw hex in components. Dark theme only.
- All UI text and code identifiers in English. `tabular-nums` for all numbers.
- Charts render states: loading / error / empty / success — all four, always.
- No new runtime dependencies without a reason written in the PR/commit body.
- Never commit `.env`; secrets are not needed anywhere in this project.

## Commands

- `npm run dev` — Vite dev server (serves `data/` via plugin).
- `npm run build` — typecheck + production build to `dist/` (copies `data/`).
- `npm test` — Vitest unit tests (aggregation, insights, scales).
- `node scripts/fetch_prices.mjs` — update data for yesterday…tomorrow.
- `node scripts/fetch_prices.mjs --from 2025-06-01 --to 2026-07-05` — backfill.
