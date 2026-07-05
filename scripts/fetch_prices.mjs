#!/usr/bin/env node
// PowerClock pipeline: Elering API (Nord Pool day-ahead, 15-min slots, UTC)
//   → data/daily/YYYY-MM-DD.json (hourly, Europe/Riga days, zones LV/EE/LT)
//   → data/aggregates.json
//
// Usage:
//   node scripts/fetch_prices.mjs                     # yesterday…tomorrow (Riga)
//   node scripts/fetch_prices.mjs --from 2025-06-01 --to 2026-07-05
//
// Node 22 built-ins only. Fails loudly (exit 1, nothing written) on API errors.

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ZONES, addDays, todayRiga, buildDaily, buildAggregates } from './lib/normalize.mjs'

const API = 'https://dashboard.elering.ee/api/nps/price'
const DATA_DIR = fileURLToPath(new URL('../data', import.meta.url))
const DAILY_DIR = join(DATA_DIR, 'daily')
const WINDOW_DAYS = 60
const CHUNK_DAYS = 90 // backfill request size; keeps responses well under API limits

function die(msg) {
  console.error(`fetch_prices: ${msg}`)
  process.exit(1)
}

function parseArgs(argv) {
  const args = {}
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--from') args.from = argv[++i]
    else if (argv[i] === '--to') args.to = argv[++i]
    else die(`unknown argument: ${argv[i]}`)
  }
  for (const key of ['from', 'to'])
    if (args[key] !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(args[key]))
      die(`--${key} must be YYYY-MM-DD (Europe/Riga local date)`)
  if ((args.from === undefined) !== (args.to === undefined)) die('--from and --to go together')
  if (args.from && args.from > args.to) die('--from must not be after --to')
  return args
}

/** One API call covering local dates [from..to] (UTC range padded ±1 day). */
async function fetchSlots(from, to) {
  const start = `${addDays(from, -1)}T00:00:00.000Z`
  const end = `${addDays(to, 1)}T23:59:59.999Z`
  const url = `${API}?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`
  let res
  try {
    res = await fetch(url, {
      signal: AbortSignal.timeout(30_000),
      headers: { accept: 'application/json' },
    })
  } catch (err) {
    die(`API request failed: ${err.message} (${url})`)
  }
  if (!res.ok) die(`API returned HTTP ${res.status} (${url})`)
  let body
  try {
    body = await res.json()
  } catch {
    die('API returned a non-JSON body')
  }
  if (body?.success !== true || !Array.isArray(body?.data?.lv) || body.data.lv.length === 0)
    die(`unexpected API payload: ${JSON.stringify(body)?.slice(0, 300)}`)
  return { LV: body.data.lv, EE: body.data.ee ?? [], LT: body.data.lt ?? [] }
}

/* Deterministic formatting: one {hour, price} row per line, stable key order,
   so reruns over unchanged data produce byte-identical files. */
function formatDaily(file) {
  const zones = ZONES.map((z) => {
    const rows = file.zones[z]
      .map((r) => `      { "hour": ${r.hour}, "price": ${r.price} }`)
      .join(',\n')
    return `    "${z}": [\n${rows}\n    ]`
  }).join(',\n')
  return `{\n  "date": "${file.date}",\n  "unit": "${file.unit}",\n  "zones": {\n${zones}\n  }\n}\n`
}

function formatAggregates(agg) {
  const nul = (v) => (v === null ? 'null' : v)
  const zones = ZONES.map((z) => {
    const zd = agg.zones[z]
    const matrix = zd.by_weekday_hour
      .map((row) => `        [${row.map(nul).join(', ')}]`)
      .join(',\n')
    const months = zd.by_month
      .map((m) => `        { "month": ${m.month}, "avg": ${nul(m.avg)} }`)
      .join(',\n')
    return (
      `    "${z}": {\n      "by_weekday_hour": [\n${matrix}\n      ],\n` +
      `      "by_month": [\n${months}\n      ],\n      "window_avg": ${nul(zd.window_avg)}\n    }`
    )
  }).join(',\n')
  return `{\n  "updated_at": "${agg.updated_at}",\n  "window_days": ${agg.window_days},\n  "zones": {\n${zones}\n  }\n}\n`
}

function readExisting(path) {
  try {
    return readFileSync(path, 'utf8')
  } catch {
    return null
  }
}

async function main() {
  const today = todayRiga()
  const { from = addDays(today, -1), to = addDays(today, 1) } = parseArgs(process.argv)

  // Fetch (chunked for backfills), dedupe overlapping pad slots by timestamp.
  const slotMaps = { LV: new Map(), EE: new Map(), LT: new Map() }
  for (let start = from; start <= to; start = addDays(start, CHUNK_DAYS)) {
    const end = addDays(start, CHUNK_DAYS - 1) < to ? addDays(start, CHUNK_DAYS - 1) : to
    const chunk = await fetchSlots(start, end)
    for (const z of ZONES)
      for (const s of chunk[z]) slotMaps[z].set(s.timestamp, s)
    console.log(`fetched ${chunk.LV.length} LV slots for ${start}..${end}`)
  }
  const slotsByZone = Object.fromEntries(ZONES.map((z) => [z, [...slotMaps[z].values()]]))

  // Normalize and write daily files (complete days only).
  const { files, skipped } = buildDaily(slotsByZone, { from, to })
  mkdirSync(DAILY_DIR, { recursive: true })
  let written = 0
  for (const file of files) {
    const path = join(DAILY_DIR, `${file.date}.json`)
    const next = formatDaily(file)
    if (readExisting(path) !== next) {
      writeFileSync(path, next)
      written++
      console.log(`wrote data/daily/${file.date}.json`)
    }
  }
  for (const { date, reason } of skipped) console.warn(`skipped ${date} (${reason})`)
  if (files.length === 0) die(`no complete days in ${from}..${to} — nothing to write`)

  // Rebuild aggregates from the full daily history on disk.
  const dailies = readdirSync(DAILY_DIR)
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .sort()
    .map((f) => JSON.parse(readFileSync(join(DAILY_DIR, f), 'utf8')))
  const agg = buildAggregates(dailies, { windowDays: WINDOW_DAYS, today })

  // updated_at bumps only when the aggregate content really changed,
  // so a no-op cron run leaves the repo diff-free.
  const aggPath = join(DATA_DIR, 'aggregates.json')
  const existing = readExisting(aggPath)
  let unchanged = false
  if (existing) {
    try {
      const { updated_at, ...core } = JSON.parse(existing)
      unchanged = JSON.stringify(core) === JSON.stringify(agg)
    } catch {
      unchanged = false
    }
  }
  if (!unchanged) {
    agg.updated_at = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
    writeFileSync(aggPath, formatAggregates(agg))
    console.log(`aggregates updated (${dailies.length} days on disk, window ${WINDOW_DAYS}d)`)
  } else {
    console.log('aggregates unchanged')
  }
  console.log(`done: ${written} daily file(s) written, ${skipped.length} skipped`)
}

await main()
