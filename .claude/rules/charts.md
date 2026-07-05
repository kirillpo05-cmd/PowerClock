---
globs:
  - "src/charts/**"
  - "src/lib/scales.ts"
---

# Radial chart rules

- Orientation: 00:00 / January at the top, clockwise. Angle helper:
  `a = frac * 2π - π/2`.
- Value encoding: bar **length + color** together. Color-only is allowed solely
  where radius already encodes time (YearSpiral) — never for hour bars.
- Every chart ships with: a `Legend` (shared component), an exact-value tooltip
  ("07:00–08:00 · 12.4 ct/kWh"), and all four render states (loading skeleton /
  error / empty / success).
- One shared sequential color scale from `scales.ts` (green→yellow→red tokens),
  domain p10–p90 of the 60-day window, clamped. Charts must not invent their own
  palettes.
- Negative prices are legal inputs: length scale domain starts at
  `min(0, minPrice)`; no `Math.sqrt`/log on raw prices.
- Missing hours/cells (DST, no data) render as gaps or neutral `--surface-2`
  fill — never interpolate fake values.
- D3 computes geometry; React renders it. No `d3.select` against React-owned
  DOM except mount-time entry transitions.
- SVG sizes via `viewBox` only; must be readable at 360 px wide.
- Display units: ct/kWh via `toCtKwh()`, one decimal, `tabular-nums`.
