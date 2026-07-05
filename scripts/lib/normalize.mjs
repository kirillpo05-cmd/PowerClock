// Pure normalization/aggregation logic for the PowerClock pipeline.
// No I/O here — fetch_prices.mjs and Vitest both import these functions.
//
// Timezone rule (CLAUDE.md): Elering timestamps are Unix seconds UTC in
// 15-minute slots; every "date"/"hour" below is Europe/Riga wall time,
// derived only via Intl.DateTimeFormat.

const TZ = 'Europe/Riga'

export const ZONES = ['LV', 'EE', 'LT']

const partsFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  hourCycle: 'h23',
})

const dateFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** Local (Europe/Riga) calendar date and hour for a Unix-seconds timestamp. */
export function rigaDateHour(unixSeconds) {
  const parts = partsFmt.formatToParts(new Date(unixSeconds * 1000))
  const get = (type) => parts.find((p) => p.type === type).value
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    hour: Number(get('hour')),
  }
}

/** Today's date (YYYY-MM-DD) in Europe/Riga. */
export function todayRiga(now = new Date()) {
  return dateFmt.format(now)
}

/** Calendar arithmetic on YYYY-MM-DD strings (timezone-free). */
export function addDays(date, n) {
  const d = new Date(`${date}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** Weekday of a YYYY-MM-DD calendar date, Mon=0 … Sun=6. */
export function weekdayIndex(date) {
  return (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7
}

export const round2 = (x) => Math.round(x * 100) / 100

const mean = (arr) => arr.reduce((s, x) => s + x, 0) / arr.length

/**
 * Group 15-minute slots [{timestamp, price}] into
 * Map<date, Map<hour, prices[]>> keyed by Riga local date/hour.
 * DST falls out automatically: the spring day lacks hour 03 (23 entries),
 * the autumn day collects 8 slots under its doubled hour.
 */
export function slotsToDays(slots) {
  const days = new Map()
  for (const slot of slots) {
    if (typeof slot?.timestamp !== 'number' || typeof slot?.price !== 'number') continue
    const { date, hour } = rigaDateHour(slot.timestamp)
    let hours = days.get(date)
    if (!hours) days.set(date, (hours = new Map()))
    let prices = hours.get(hour)
    if (!prices) hours.set(hour, (prices = []))
    prices.push(slot.price)
  }
  return days
}

/**
 * Build data/daily/*.json payloads for local dates in [from..to].
 * A day is written only when zone LV has ≥23 hourly entries (SPEC §1.2);
 * partially published days are reported in `skipped`.
 */
export function buildDaily(slotsByZone, { from, to }) {
  const perZone = new Map(ZONES.map((z) => [z, slotsToDays(slotsByZone[z] ?? [])]))
  const dates = new Set()
  for (const days of perZone.values()) for (const date of days.keys()) dates.add(date)

  const files = []
  const skipped = []
  for (const date of [...dates].sort()) {
    if (date < from || date > to) continue
    const lvHours = perZone.get('LV').get(date)
    if (!lvHours || lvHours.size < 23) {
      skipped.push({ date, reason: `incomplete: ${lvHours?.size ?? 0}/24 LV hours` })
      continue
    }
    const zones = {}
    for (const z of ZONES) {
      const hours = perZone.get(z).get(date) ?? new Map()
      zones[z] = [...hours.keys()]
        .sort((a, b) => a - b)
        .map((hour) => ({ hour, price: round2(mean(hours.get(hour))) }))
    }
    files.push({ date, unit: 'EUR/MWh', zones })
  }
  return { files, skipped }
}

/**
 * Aggregates over daily files (SPEC §1.2/§1.5):
 * - by_weekday_hour: mean over the last `windowDays` *completed* local days
 *   (today excluded), Mon=0; null where no observations;
 * - window_avg: mean over every hour of that window;
 * - by_month: mean over ALL available daily files per calendar month.
 * `updated_at` is intentionally not set here — the caller adds it only when
 * the content actually changed, keeping reruns diff-free.
 */
export function buildAggregates(dailies, { windowDays = 60, today }) {
  const sorted = [...dailies].sort((a, b) => (a.date < b.date ? -1 : 1))
  const window = sorted.filter((d) => d.date < today).slice(-windowDays)

  const zones = {}
  for (const z of ZONES) {
    const sums = Array.from({ length: 7 }, () => Array(24).fill(0))
    const counts = Array.from({ length: 7 }, () => Array(24).fill(0))
    let windowSum = 0
    let windowCount = 0
    for (const day of window) {
      const w = weekdayIndex(day.date)
      for (const { hour, price } of day.zones[z] ?? []) {
        sums[w][hour] += price
        counts[w][hour] += 1
        windowSum += price
        windowCount += 1
      }
    }
    const by_weekday_hour = sums.map((row, w) =>
      row.map((sum, h) => (counts[w][h] ? round2(sum / counts[w][h]) : null)),
    )

    const monthSums = Array(12).fill(0)
    const monthCounts = Array(12).fill(0)
    for (const day of sorted) {
      const m = Number(day.date.slice(5, 7)) - 1
      for (const { price } of day.zones[z] ?? []) {
        monthSums[m] += price
        monthCounts[m] += 1
      }
    }
    const by_month = monthSums.map((sum, i) => ({
      month: i + 1,
      avg: monthCounts[i] ? round2(sum / monthCounts[i]) : null,
    }))

    zones[z] = {
      by_weekday_hour,
      by_month,
      window_avg: windowCount ? round2(windowSum / windowCount) : null,
    }
  }
  return { window_days: windowDays, zones }
}
