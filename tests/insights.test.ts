import { describe, expect, it } from 'vitest'
import {
  bestWeekSlot,
  buildInsights,
  cheapestHour,
  priciestHour,
  todayVsWindow,
} from '../src/lib/insights'
import type { HourPrice, ZoneAggregates } from '../src/lib/loader'

const day = (...prices: number[]): HourPrice[] => prices.map((price, hour) => ({ hour, price }))

function agg(overrides: Partial<ZoneAggregates> = {}): ZoneAggregates {
  return {
    by_weekday_hour: Array.from({ length: 7 }, () => Array(24).fill(50)),
    by_month: Array.from({ length: 12 }, (_, i) => ({ month: i + 1, avg: 50 })),
    window_avg: 50,
    ...overrides,
  }
}

describe('cheapestHour / priciestHour', () => {
  it('finds extremes and formats ct/kWh with the hour interval', () => {
    const cheap = cheapestHour(day(100, 21, 300))
    expect(cheap).toMatchObject({ value: '01:00–02:00', detail: '2.1 ct/kWh', tone: 'good' })
    const pricey = priciestHour(day(100, 21, 300))
    expect(pricey).toMatchObject({ value: '02:00–03:00', detail: '30.0 ct/kWh', tone: 'bad' })
  })

  it('resolves ties to the earlier hour', () => {
    expect(cheapestHour(day(10, 10, 20))?.value).toBe('00:00–01:00')
    expect(priciestHour(day(20, 10, 20))?.value).toBe('00:00–01:00')
  })

  it('handles negative prices', () => {
    expect(cheapestHour(day(5, -12.3))?.detail).toBe('-1.2 ct/kWh')
  })

  it('is total on null and empty input', () => {
    expect(cheapestHour(null)).toBeNull()
    expect(priciestHour([])).toBeNull()
  })
})

describe('bestWeekSlot', () => {
  it('finds the cheapest weekday×hour cell (Mon=0 labels)', () => {
    const a = agg()
    a.by_weekday_hour[6]![3] = 12 // Sunday 03:00
    const insight = bestWeekSlot(a)
    expect(insight).toMatchObject({ value: 'Sun 03:00', detail: 'avg 1.2 ct/kWh, last 60 days' })
  })

  it('hides itself when less than half of the matrix is filled', () => {
    const sparse = agg({
      by_weekday_hour: Array.from({ length: 7 }, () => Array(24).fill(null)),
    })
    sparse.by_weekday_hour[0]![0] = 5
    expect(bestWeekSlot(sparse)).toBeNull()
  })

  it('is total on null/malformed aggregates', () => {
    expect(bestWeekSlot(null)).toBeNull()
    expect(bestWeekSlot({ by_weekday_hour: [], by_month: [], window_avg: 1 })).toBeNull()
  })
})

describe('todayVsWindow', () => {
  it('reports a rounded percentage above the window average', () => {
    const insight = todayVsWindow(day(59, 59), agg())
    expect(insight).toMatchObject({ value: '+18%', tone: 'bad' })
  })

  it('marks cheaper days as good', () => {
    expect(todayVsWindow(day(40, 40), agg())).toMatchObject({ value: '-20%', tone: 'good' })
  })

  it('treats |Δ| < 3% as about average', () => {
    expect(todayVsWindow(day(51, 51), agg())).toMatchObject({
      value: 'about average',
      tone: 'neutral',
    })
  })

  it('hides itself when the window average is missing or non-positive', () => {
    expect(todayVsWindow(day(50), agg({ window_avg: null }))).toBeNull()
    expect(todayVsWindow(day(50), agg({ window_avg: 0 }))).toBeNull()
    expect(todayVsWindow(day(50), agg({ window_avg: -4 }))).toBeNull()
  })
})

describe('buildInsights', () => {
  it('returns all four cards on full data', () => {
    const ids = buildInsights(day(...Array(24).fill(50)), agg()).map((i) => i.id)
    expect(ids).toEqual(['cheapest-today', 'priciest-today', 'best-week-slot', 'today-vs-avg'])
  })

  it('degrades to aggregate-only cards when today is missing', () => {
    const ids = buildInsights(null, agg()).map((i) => i.id)
    expect(ids).toEqual(['best-week-slot'])
  })

  it('returns an empty list on no data at all', () => {
    expect(buildInsights(null, null)).toEqual([])
  })
})
