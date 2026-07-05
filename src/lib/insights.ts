// Pure insight functions (SPEC §3). Total on null/empty inputs: they return
// fewer insights instead of throwing — the UI simply renders fewer cards.

import type { HourPrice, ZoneAggregates } from './loader'
import { formatCt, hourLabel, hourRange } from './scales'

export type Insight = {
  id: 'cheapest-today' | 'priciest-today' | 'best-week-slot' | 'today-vs-avg'
  title: string
  value: string
  detail: string
  tone: 'good' | 'bad' | 'neutral'
}

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/** Extreme entry; ties resolve to the earlier hour. */
function extremeHour(entries: HourPrice[], kind: 'min' | 'max'): HourPrice | null {
  if (entries.length === 0) return null
  return entries.reduce((best, e) => {
    const better = kind === 'min' ? e.price < best.price : e.price > best.price
    return better ? e : best
  })
}

export function cheapestHour(entries: HourPrice[] | null): Insight | null {
  const e = extremeHour(entries ?? [], 'min')
  if (!e) return null
  return {
    id: 'cheapest-today',
    title: 'Cheapest hour today',
    value: hourRange(e.hour),
    detail: `${formatCt(e.price)} ct/kWh`,
    tone: 'good',
  }
}

export function priciestHour(entries: HourPrice[] | null): Insight | null {
  const e = extremeHour(entries ?? [], 'max')
  if (!e) return null
  return {
    id: 'priciest-today',
    title: 'Most expensive hour today',
    value: hourRange(e.hour),
    detail: `${formatCt(e.price)} ct/kWh`,
    tone: 'bad',
  }
}

/**
 * Cheapest weekday×hour slot of the aggregate matrix. Hidden unless at least
 * half of the 168 cells have data (SPEC §3.5).
 */
export function bestWeekSlot(agg: ZoneAggregates | null, windowDays = 60): Insight | null {
  const matrix = agg?.by_weekday_hour
  if (!matrix || matrix.length !== 7) return null
  let filled = 0
  let best: { w: number; h: number; v: number } | null = null
  for (let w = 0; w < 7; w++) {
    for (let h = 0; h < 24; h++) {
      const v = matrix[w]?.[h]
      if (v == null) continue
      filled++
      if (best === null || v < best.v) best = { w, h, v }
    }
  }
  if (!best || filled < 84) return null
  return {
    id: 'best-week-slot',
    title: 'Cheapest slot of the week',
    value: `${WEEKDAY_LABELS[best.w]} ${hourLabel(best.h)}`,
    detail: `avg ${formatCt(best.v)} ct/kWh, last ${windowDays} days`,
    tone: 'good',
  }
}

/**
 * Today's mean vs the window average. Hidden when the average is missing or
 * non-positive (a percentage against ≤0 is meaningless). |Δ| < 3% reads as
 * "about average".
 */
export function todayVsWindow(
  entries: HourPrice[] | null,
  agg: ZoneAggregates | null,
  windowDays = 60,
): Insight | null {
  const windowAvg = agg?.window_avg
  if (!entries || entries.length === 0 || windowAvg == null || windowAvg <= 0) return null
  const todayMean = entries.reduce((s, e) => s + e.price, 0) / entries.length
  const delta = Math.round(((todayMean - windowAvg) / windowAvg) * 100)
  const detail = `today ${formatCt(todayMean)} vs ${formatCt(windowAvg)} ct/kWh`
  if (Math.abs(delta) < 3) {
    return {
      id: 'today-vs-avg',
      title: `Today vs ${windowDays}-day average`,
      value: 'about average',
      detail,
      tone: 'neutral',
    }
  }
  return {
    id: 'today-vs-avg',
    title: `Today vs ${windowDays}-day average`,
    value: `${delta > 0 ? '+' : ''}${delta}%`,
    detail,
    tone: delta > 0 ? 'bad' : 'good',
  }
}

export function buildInsights(
  today: HourPrice[] | null,
  agg: ZoneAggregates | null,
  windowDays = 60,
): Insight[] {
  return [
    cheapestHour(today),
    priciestHour(today),
    bestWeekSlot(agg, windowDays),
    todayVsWindow(today, agg, windowDays),
  ].filter((i): i is Insight => i !== null)
}
