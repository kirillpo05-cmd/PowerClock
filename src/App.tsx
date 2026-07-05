import { useEffect, useMemo, useState } from 'react'
import ClockChart from './charts/ClockChart'
import WeekRing from './charts/WeekRing'
import YearSpiral from './charts/YearSpiral'
import type { TooltipInfo } from './charts/tooltip'
import { buildInsights } from './lib/insights'
import {
  ZONES,
  currentHourRiga,
  loadAggregates,
  loadDaily,
  todayRiga,
  tomorrowRiga,
  type Aggregates,
  type DayPrices,
  type Zone,
} from './lib/loader'
import { makePriceColorScale } from './lib/scales'
import { Card, InsightCard } from './ui/Card'
import { Header } from './ui/Header'
import { Legend } from './ui/Legend'
import { Segmented } from './ui/Segmented'

const ZONE_KEY = 'powerclock:zone'

function initialZone(): Zone {
  const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(ZONE_KEY) : null
  if (stored && (ZONES as readonly string[]).includes(stored)) return stored as Zone
  const env = import.meta.env.VITE_DEFAULT_ZONE as string | undefined
  if (env && (ZONES as readonly string[]).includes(env)) return env as Zone
  return 'LV'
}

/** "Sunday, 5 July" — the date string is already a Riga calendar date. */
function formatDate(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  })
}

export default function App() {
  const [zone, setZone] = useState<Zone>(initialZone)
  const [agg, setAgg] = useState<Aggregates | null>(null)
  const [days, setDays] = useState<{ today: DayPrices | null; tomorrow: DayPrices | null }>({
    today: null,
    tomorrow: null,
  })
  const [loading, setLoading] = useState(true)
  const [dayKey, setDayKey] = useState<'today' | 'tomorrow'>('today')
  const [tooltip, setTooltip] = useState<TooltipInfo | null>(null)

  // Riga wall clock, re-evaluated every minute (SPEC §2.6: midnight rollover).
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])
  const todayStr = todayRiga(now)
  const tomorrowStr = tomorrowRiga(now)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([loadAggregates(), loadDaily(todayStr), loadDaily(tomorrowStr)]).then(
      ([a, today, tomorrow]) => {
        if (cancelled) return
        setAgg(a)
        setDays({ today, tomorrow })
        setLoading(false)
      },
    )
    return () => {
      cancelled = true
    }
  }, [todayStr, tomorrowStr])

  useEffect(() => {
    localStorage.setItem(ZONE_KEY, zone)
  }, [zone])

  const zoneAgg = agg?.zones[zone] ?? null
  const windowDays = agg?.window_days ?? 60
  const todayEntries = days.today?.zones[zone] ?? null
  const tomorrowEntries = days.tomorrow?.zones[zone] ?? null
  const tomorrowMissing = !tomorrowEntries || tomorrowEntries.length === 0

  // Never leave the toggle stuck on a day that has no data (midnight rollover).
  useEffect(() => {
    if (dayKey === 'tomorrow' && tomorrowMissing) setDayKey('today')
  }, [dayKey, tomorrowMissing])

  const shownEntries = dayKey === 'today' ? todayEntries : tomorrowEntries

  // Shared cheap→expensive scale; domain p10–p90 of the 60-day window,
  // falling back to the visible days when aggregates are unavailable.
  const priceScale = useMemo(() => {
    const matrixVals =
      zoneAgg?.by_weekday_hour.flat().filter((v): v is number => v !== null) ?? []
    const sample =
      matrixVals.length > 0
        ? matrixVals
        : [...(todayEntries ?? []), ...(tomorrowEntries ?? [])].map((e) => e.price)
    return makePriceColorScale(sample)
  }, [zoneAgg, todayEntries, tomorrowEntries])

  // One bar-length domain across today+tomorrow so the toggle compares fairly.
  const lengthDomain = useMemo<[number, number]>(() => {
    const prices = [...(todayEntries ?? []), ...(tomorrowEntries ?? [])].map((e) => e.price)
    if (prices.length === 0) return [0, 1]
    return [Math.min(0, ...prices), Math.max(...prices)]
  }, [todayEntries, tomorrowEntries])

  const monthAvgs = useMemo(
    () => zoneAgg?.by_month.map((m) => m.avg).filter((v): v is number => v !== null) ?? [],
    [zoneAgg],
  )
  // Spiral encodes value by color only, so use the full min–max domain (SPEC §5.5).
  const spiralScale = useMemo(() => makePriceColorScale(monthAvgs, 0, 1), [monthAvgs])

  const matrixHasData = (zoneAgg?.by_weekday_hour.flat() ?? []).some((v) => v !== null)
  const insights = buildInsights(todayEntries, zoneAgg, windowDays)
  const nothingLoaded = !loading && !agg && !days.today

  return (
    <main className="mx-auto max-w-[1080px] px-4 py-8">
      <Header zone={zone} onZoneChange={setZone} updatedAt={agg?.updated_at ?? null} />

      {nothingLoaded ? (
        <Card title="Data unavailable">
          <p className="text-sm text-muted">
            Could not load price snapshots. If this persists, the data pipeline may be down —
            check back later.
          </p>
        </Card>
      ) : (
        <>
          {/* Hero: the price clock */}
          <Card
            title="Price clock"
            subtitle={
              loading
                ? 'loading…'
                : formatDate(dayKey === 'today' ? todayStr : tomorrowStr)
            }
            action={
              <Segmented
                ariaLabel="Day"
                options={[
                  { value: 'today', label: 'Today' },
                  {
                    value: 'tomorrow',
                    label: 'Tomorrow',
                    disabled: tomorrowMissing,
                    hint: tomorrowMissing
                      ? 'Day-ahead prices are published around 15:30 Riga time'
                      : undefined,
                  },
                ]}
                value={dayKey}
                onChange={setDayKey}
              />
            }
          >
            {loading ? (
              <div className="skeleton mx-auto aspect-square w-full max-w-[420px] !rounded-full" />
            ) : !shownEntries || shownEntries.length === 0 ? (
              <p className="py-16 text-center text-sm text-muted">
                No prices for this day yet.
              </p>
            ) : (
              <div className="mx-auto max-w-[560px]">
                <ClockChart
                  entries={shownEntries}
                  currentHour={dayKey === 'today' ? currentHourRiga(now) : null}
                  scale={priceScale}
                  lengthDomain={lengthDomain}
                  onTooltip={setTooltip}
                />
                <div className="mt-2 px-6">
                  <Legend scale={priceScale} note={`cheap → expensive, ${windowDays}-day range`} />
                </div>
              </div>
            )}
          </Card>

          {/* Insight cards */}
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {loading
              ? Array.from({ length: 4 }, (_, i) => <div key={i} className="skeleton h-32" />)
              : insights.map((insight) => <InsightCard key={insight.id} insight={insight} />)}
          </div>

          {/* Patterns: week ring + year spiral */}
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {loading ? (
              <>
                <div className="skeleton aspect-square" />
                <div className="skeleton aspect-square" />
              </>
            ) : (
              <>
                {matrixHasData && zoneAgg && (
                  <Card
                    title="Weekly ring"
                    subtitle={`average price by weekday × hour, last ${windowDays} days`}
                  >
                    <WeekRing
                      matrix={zoneAgg.by_weekday_hour}
                      windowDays={windowDays}
                      scale={priceScale}
                      onTooltip={setTooltip}
                    />
                    <div className="mt-2 px-6">
                      <Legend scale={priceScale} />
                    </div>
                  </Card>
                )}
                {monthAvgs.length > 0 && zoneAgg && (
                  <Card title="Year spiral" subtitle="monthly averages, all recorded history">
                    <YearSpiral
                      byMonth={zoneAgg.by_month}
                      scale={spiralScale}
                      onTooltip={setTooltip}
                    />
                    <div className="mt-2 px-6">
                      <Legend scale={spiralScale} />
                    </div>
                  </Card>
                )}
              </>
            )}
          </div>
        </>
      )}

      <footer className="mt-10 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
        <span>
          Data:{' '}
          <a
            className="underline hover:text-text"
            href="https://dashboard.elering.ee/en/nps/price"
            target="_blank"
            rel="noreferrer"
          >
            Elering
          </a>{' '}
          · Nord Pool day-ahead · wholesale prices excl. taxes and grid fees
        </span>
        <a
          className="underline hover:text-text"
          href="https://github.com/kirillpo05-cmd/PowerClock"
          target="_blank"
          rel="noreferrer"
        >
          GitHub ↗
        </a>
      </footer>

      {tooltip && (
        <div
          className="pointer-events-none fixed z-50 rounded-lg bg-surface-2 px-3 py-2 text-xs shadow-lg"
          style={{
            left: Math.min(tooltip.x + 14, window.innerWidth - 180),
            top: tooltip.y + 14,
          }}
        >
          <div className="font-semibold">{tooltip.title}</div>
          <div className="mt-0.5 text-muted">{tooltip.value}</div>
        </div>
      )}
    </main>
  )
}
