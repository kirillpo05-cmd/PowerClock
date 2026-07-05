---
globs:
  - "src/ui/**"
  - "src/App.tsx"
  - "index.html"
---

# UI & design-system rules

- Dark theme only. All colors come from CSS variables in `src/ui/theme.css`:
  `--bg #0B0E14`, `--surface #131826`, `--text #E6EAF2`, `--muted`, `--accent
  #60A5FA`, `--good #22C55E`, `--warn #EAB308`, `--bad #EF4444`, `--radius 16px`.
  Raw hex in a component is a defect.
- Typography: Inter (with system-ui fallback), headings weight 600, every
  numeric value `font-variant-numeric: tabular-nums`.
- Tailwind v4 utilities are fine, but color/radius utilities must reference the
  tokens (arbitrary values like `bg-[#131826]` are banned).
- Entry animations 400–600 ms ease-out; hover feedback instant; wrap all motion
  in `@media (prefers-reduced-motion: no-preference)`.
- Layout: single column, max-width 1080 px, no horizontal scroll at 360 px.
  The clock is the hero — visible without scrolling on a laptop.
- All user-facing text in English. Dates/hours shown are Europe/Riga wall time.
- Freshness badge thresholds: green ≤26 h, yellow ≤48 h, red >48 h since
  `aggregates.updated_at`.
