// Data access + Europe/Riga time helpers. The frontend never calls the
// Elering API — it reads the JSON snapshots committed by the pipeline.

export const ZONES = ['LV', 'EE', 'LT'] as const
export type Zone = (typeof ZONES)[number]

export type HourPrice = { hour: number; price: number } // price: EUR/MWh

export type DayPrices = {
  date: string
  unit: string
  zones: Record<Zone, HourPrice[]>
}

export type ZoneAggregates = {
  by_weekday_hour: (number | null)[][]
  by_month: { month: number; avg: number | null }[]
  window_avg: number | null
}

export type Aggregates = {
  updated_at: string
  window_days: number
  zones: Record<Zone, ZoneAggregates>
}

const TZ = 'Europe/Riga'

const dateFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const hourFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ,
  hour: '2-digit',
  hourCycle: 'h23',
})

/** Today's calendar date (YYYY-MM-DD) on a Riga wall clock. */
export function todayRiga(now: Date = new Date()): string {
  return dateFmt.format(now)
}

export function tomorrowRiga(now: Date = new Date()): string {
  const d = new Date(`${todayRiga(now)}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

/** Current hour of day (0–23) on a Riga wall clock. */
export function currentHourRiga(now: Date = new Date()): number {
  return Number(hourFmt.format(now))
}

async function loadJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}${path}`)
    if (!res.ok) return null
    return (await res.json()) as T
  } catch (err) {
    console.warn(`loader: failed to fetch ${path}`, err)
    return null
  }
}

/** Daily snapshot for a Riga-local date; null when absent (e.g. tomorrow not yet published). */
export function loadDaily(date: string): Promise<DayPrices | null> {
  return loadJson<DayPrices>(`data/daily/${date}.json`)
}

export function loadAggregates(): Promise<Aggregates | null> {
  return loadJson<Aggregates>('data/aggregates.json')
}
