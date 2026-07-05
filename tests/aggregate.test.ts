import { describe, expect, it } from 'vitest'
// @ts-expect-error — pipeline logic is untyped .mjs by design (no-deps Node script)
import {
  addDays,
  buildAggregates,
  buildDaily,
  round2,
  slotsToDays,
  weekdayIndex,
} from '../scripts/lib/normalize.mjs'

type Slot = { timestamp: number; price: number }
type HourPrice = { hour: number; price: number }

const SLOT_S = 900
const ts = (iso: string) => Date.parse(iso) / 1000

/** 15-minute slots starting at a UTC instant. */
function slots(startIso: string, count: number, price: (i: number) => number): Slot[] {
  const start = ts(startIso)
  return Array.from({ length: count }, (_, i) => ({
    timestamp: start + i * SLOT_S,
    price: price(i),
  }))
}

function zoned(lv: Slot[]) {
  return { LV: lv, EE: lv, LT: lv }
}

function day(date: string, hours: Array<[number, number]>): {
  date: string
  unit: string
  zones: Record<string, HourPrice[]>
} {
  const entries = hours.map(([hour, price]) => ({ hour, price }))
  return { date, unit: 'EUR/MWh', zones: { LV: entries, EE: [], LT: [] } }
}

describe('slotsToDays', () => {
  it('maps a UTC slot to its Europe/Riga local date and hour (summer = UTC+3)', () => {
    const days = slotsToDays(slots('2026-07-04T00:00:00Z', 1, () => 18.83))
    expect([...days.keys()]).toEqual(['2026-07-04'])
    expect([...days.get('2026-07-04')!.keys()]).toEqual([3])
  })

  it('maps a winter (UTC+2) slot correctly', () => {
    const days = slotsToDays(slots('2026-01-15T22:00:00Z', 1, () => 50))
    expect([...days.keys()]).toEqual(['2026-01-16'])
    expect([...days.get('2026-01-16')!.keys()]).toEqual([0])
  })

  it('ignores malformed slots without throwing', () => {
    const days = slotsToDays([{ timestamp: 'x', price: 1 }, { price: 2 }, null] as never[])
    expect(days.size).toBe(0)
  })
})

describe('buildDaily', () => {
  it('averages four 15-minute slots into one hourly price', () => {
    const prices = [18.83, 19.25, 16.96, 17.18]
    const lv = slots('2026-07-03T21:00:00Z', 96, (i) => prices[i % 4]!)
    const { files } = buildDaily(zoned(lv), { from: '2026-07-04', to: '2026-07-04' })
    expect(files).toHaveLength(1)
    expect(files[0].zones.LV[0]).toEqual({ hour: 0, price: 18.06 })
    expect(files[0].zones.LV).toHaveLength(24)
  })

  it('accepts legacy hourly slots (one per hour)', () => {
    const lv = Array.from({ length: 24 }, (_, h) => ({
      timestamp: ts('2026-01-15T22:00:00Z') + h * 3600,
      price: h,
    }))
    const { files } = buildDaily(zoned(lv), { from: '2026-01-16', to: '2026-01-16' })
    expect(files[0].zones.LV).toHaveLength(24)
    expect(files[0].zones.LV[5]).toEqual({ hour: 5, price: 5 })
  })

  it('spring DST day (2026-03-29) has 23 entries and no hour 03', () => {
    // Local day: 2026-03-28T22:00Z … 2026-03-29T21:00Z = 23 real hours.
    const lv = slots('2026-03-28T22:00:00Z', 23 * 4, () => 42)
    const { files } = buildDaily(zoned(lv), { from: '2026-03-29', to: '2026-03-29' })
    expect(files[0].zones.LV).toHaveLength(23)
    expect(files[0].zones.LV.map((h: HourPrice) => h.hour)).not.toContain(3)
  })

  it('averages the doubled autumn-DST hour (2025-10-26) over 8 slots', () => {
    // Local day: 2025-10-25T21:00Z … 2025-10-26T22:00Z = 25 real hours.
    // Local hour 03 spans 00:00Z–02:00Z (slots 12–19): first 4 at 10, next 4 at 20.
    const lv = slots('2025-10-25T21:00:00Z', 25 * 4, (i) => (i >= 12 && i < 16 ? 10 : i >= 16 && i < 20 ? 20 : 5))
    const { files } = buildDaily(zoned(lv), { from: '2025-10-26', to: '2025-10-26' })
    expect(files[0].zones.LV).toHaveLength(24)
    expect(files[0].zones.LV[3]).toEqual({ hour: 3, price: 15 })
  })

  it('skips a partially published day (<23 LV hours) with a reason', () => {
    const lv = slots('2026-07-04T21:00:00Z', 10 * 4, () => 30) // only 10 hours of tomorrow
    const { files, skipped } = buildDaily(zoned(lv), { from: '2026-07-05', to: '2026-07-05' })
    expect(files).toHaveLength(0)
    expect(skipped).toEqual([{ date: '2026-07-05', reason: 'incomplete: 10/24 LV hours' }])
  })

  it('drops dates outside [from..to]', () => {
    const lv = slots('2026-07-03T21:00:00Z', 96 * 3, () => 30) // 3 full local days
    const { files } = buildDaily(zoned(lv), { from: '2026-07-05', to: '2026-07-05' })
    expect(files.map((f: { date: string }) => f.date)).toEqual(['2026-07-05'])
  })

  it('keeps negative prices intact', () => {
    const lv = slots('2026-07-03T21:00:00Z', 96, () => -5.13)
    const { files } = buildDaily(zoned(lv), { from: '2026-07-04', to: '2026-07-04' })
    expect(files[0].zones.LV[0].price).toBe(-5.13)
  })
})

describe('buildAggregates', () => {
  it('places a Friday price at row 4 of the Mon=0 matrix, nulls elsewhere', () => {
    const agg = buildAggregates([day('2026-07-03', [[0, 10]])], { windowDays: 60, today: '2026-07-05' })
    expect(agg.zones.LV.by_weekday_hour[4][0]).toBe(10)
    expect(agg.zones.LV.by_weekday_hour[4][1]).toBeNull()
    expect(agg.zones.LV.by_weekday_hour[0][0]).toBeNull()
  })

  it('excludes today and tomorrow from the weekday window', () => {
    const agg = buildAggregates(
      [day('2026-07-04', [[0, 10]]), day('2026-07-05', [[0, 99]]), day('2026-07-06', [[0, 99]])],
      { windowDays: 60, today: '2026-07-05' },
    )
    expect(agg.zones.LV.window_avg).toBe(10)
  })

  it('keeps only the most recent windowDays completed days', () => {
    const agg = buildAggregates(
      [day('2026-07-01', [[0, 100]]), day('2026-07-02', [[0, 10]]), day('2026-07-03', [[0, 20]])],
      { windowDays: 2, today: '2026-07-05' },
    )
    expect(agg.zones.LV.window_avg).toBe(15) // 100 fell out of the window
  })

  it('averages by_month over ALL history and yields null for empty months', () => {
    const agg = buildAggregates(
      [day('2025-03-10', [[0, 30]]), day('2026-03-10', [[0, 10]]), day('2026-07-04', [[0, 7]])],
      { windowDays: 60, today: '2026-07-05' },
    )
    const byMonth = agg.zones.LV.by_month
    expect(byMonth[2]).toEqual({ month: 3, avg: 20 }) // two Marches averaged
    expect(byMonth[6]).toEqual({ month: 7, avg: 7 })
    expect(byMonth[0]).toEqual({ month: 1, avg: null })
  })

  it('returns nulls (not zeros) when there is no completed history', () => {
    const agg = buildAggregates([day('2026-07-05', [[0, 10]])], { windowDays: 60, today: '2026-07-05' })
    expect(agg.zones.LV.window_avg).toBeNull()
    expect(agg.zones.LV.by_weekday_hour.every((row: (number | null)[]) => row.every((v) => v === null))).toBe(true)
  })

  it('survives negative window averages', () => {
    const agg = buildAggregates([day('2026-07-03', [[0, -20], [1, -10]])], { windowDays: 60, today: '2026-07-05' })
    expect(agg.zones.LV.window_avg).toBe(-15)
  })
})

describe('calendar helpers', () => {
  it('weekdayIndex: Mon=0, Sun=6', () => {
    expect(weekdayIndex('2026-06-29')).toBe(0) // Monday
    expect(weekdayIndex('2026-07-05')).toBe(6) // Sunday
  })

  it('addDays crosses month and year boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('round2 rounds to cents', () => {
    expect(round2(18.055)).toBe(18.06)
    expect(round2(-5.128)).toBe(-5.13)
  })
})
