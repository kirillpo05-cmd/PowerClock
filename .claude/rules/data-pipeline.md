---
globs:
  - "scripts/**"
  - ".github/workflows/**"
  - "data/**"
---

# Pipeline & data rules

- `data/**` is machine-written by `scripts/fetch_prices.mjs` — never hand-edit;
  regenerate instead.
- Scripts: Node 22 built-ins only (global `fetch`, `node:fs`, `Intl`). No npm
  runtime deps.
- Timestamps from Elering are Unix **seconds** UTC in 15-minute slots; local
  date/hour derivation goes through `Intl.DateTimeFormat` with
  `timeZone: 'Europe/Riga'` — a hardcoded UTC offset is a rejected change.
- Write a daily file only when the local day is complete (≥23 hourly entries
  for LV). Round prices to 2 decimals. Keys and dates serialized in stable
  order — reruns must yield empty git diffs.
- On any API failure: print the reason to stderr, `process.exit(1)`, write
  nothing. Partial writes are worse than no writes.
- Workflows: least privilege (`contents: write` only in data.yml; `pages: write`
  + `id-token: write` only in the deploy job). Pin action majors (e.g.
  `actions/checkout@v4`). Deploy builds from `ref: main`, not the triggering SHA.
- Pure computation (slot→hour grouping, aggregates) lives in
  `scripts/lib/normalize.mjs`, no I/O — Vitest imports it directly.
