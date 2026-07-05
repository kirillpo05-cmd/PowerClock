---
globs:
  - "tests/**"
  - "vitest.config.*"
---

# Test rules

- Unit tests cover pure logic only: normalization (`scripts/lib/normalize.mjs`),
  aggregates, insights, scales. Charts are verified visually — no snapshot tests
  of SVG paths.
- Mandatory scenarios (not optional): DST spring day (23 hours, hour 03 absent),
  DST autumn day (25 hours of slots → 24 entries, doubled hour averaged),
  weekday matrix Mon=0 with today excluded, `null` (not 0) for empty cells,
  insights on `null`/empty inputs return "no insight" without throwing,
  negative prices.
- Build fixtures from realistic Elering shapes: 15-minute slots, Unix-second
  timestamps, EUR/MWh floats. Don't invent hourly-slot fixtures — the API
  doesn't send those anymore.
- No network in tests. No mocking of `Intl` — pick real dates (e.g.
  2026-03-29, 2026-10-25) whose DST behavior is fixed forever.
- A test name states the rule it guards: `averages the doubled autumn-DST hour
  over 8 slots`, not `test aggregates 2`.
