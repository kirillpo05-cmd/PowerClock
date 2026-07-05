// Unit conversion, formatting and the shared price color scale.
// The single EUR/MWh → ct/kWh conversion point for the whole app (CLAUDE.md).

import { interpolateRgbBasis, scaleSequential } from 'd3'

/** EUR/MWh → euro cents per kWh. */
export function toCtKwh(eurMwh: number): number {
  return eurMwh / 10
}

/** Display formatting: one decimal, e.g. 105 EUR/MWh → "10.5". */
export function formatCt(eurMwh: number): string {
  return toCtKwh(eurMwh).toFixed(1)
}

export function hourLabel(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`
}

/** "07:00–08:00" — the interval a price applies to. */
export function hourRange(hour: number): string {
  return `${hourLabel(hour)}–${hourLabel((hour + 1) % 24)}`
}

/** Linear-interpolated percentile of an unsorted sample, p in [0..1]. */
export function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b)
  if (sorted.length === 0) return NaN
  const pos = (sorted.length - 1) * p
  const lo = Math.floor(pos)
  const hi = Math.ceil(pos)
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (pos - lo)
}

// Fallbacks mirror --good/--warn/--bad in src/ui/theme.css for non-DOM
// contexts (unit tests); in the browser the live tokens win.
const STOP_TOKENS: Array<[string, string]> = [
  ['--good', '#22c55e'],
  ['--warn', '#eab308'],
  ['--bad', '#ef4444'],
]

function cssVar(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback
}

export type PriceColorScale = {
  color: (eurMwh: number) => string
  domain: [number, number]
}

/**
 * Shared cheap→expensive scale (green→yellow→red), clamped. Default domain is
 * p10–p90 of the sample — robust to spike days; pass (0, 1) for a plain
 * min–max domain (YearSpiral). Degenerate samples get a ±1 domain.
 */
export function makePriceColorScale(sample: number[], pLo = 0.1, pHi = 0.9): PriceColorScale {
  let lo = percentile(sample, pLo)
  let hi = percentile(sample, pHi)
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) {
    lo = 0
    hi = 1
  }
  if (lo === hi) {
    lo -= 1
    hi += 1
  }
  const interpolator = interpolateRgbBasis(STOP_TOKENS.map(([name, fb]) => cssVar(name, fb)))
  const scale = scaleSequential(interpolator).domain([lo, hi]).clamp(true)
  return { color: (v: number) => scale(v), domain: [lo, hi] }
}
