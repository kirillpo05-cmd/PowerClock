import { ZONES, type Zone } from '../lib/loader'
import { Segmented } from './Segmented'

type Props = {
  zone: Zone
  onZoneChange: (zone: Zone) => void
  /** aggregates.updated_at; null while loading / on error. */
  updatedAt: string | null
}

function freshness(updatedAt: string): { label: string; color: string } {
  const hours = (Date.now() - Date.parse(updatedAt)) / 3_600_000
  const label = hours < 1 ? 'updated <1 h ago' : `updated ${Math.round(hours)} h ago`
  // thresholds from SPEC: green ≤26 h, yellow ≤48 h, red beyond
  const color = hours <= 26 ? 'var(--good)' : hours <= 48 ? 'var(--warn)' : 'var(--bad)'
  return { label, color }
}

export function Header({ zone, onZoneChange, updatedAt }: Props) {
  const fresh = updatedAt ? freshness(updatedAt) : null

  return (
    <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 className="flex items-center gap-2.5 text-2xl">
          <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true">
            <circle cx="16" cy="16" r="14" fill="var(--surface-2)" />
            <path d="M17.5 6 10 18h5l-1.5 8L21 14h-5z" fill="var(--warn)" />
          </svg>
          PowerClock
        </h1>
        <p className="mt-1 text-sm text-muted">
          Nord Pool day-ahead electricity prices, radial view
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        {fresh && (
          <span className="flex items-center gap-1.5 text-xs text-muted" title={updatedAt ?? ''}>
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: fresh.color }}
            />
            {fresh.label}
          </span>
        )}
        <Segmented
          ariaLabel="Price zone"
          options={ZONES.map((z) => ({ value: z, label: z }))}
          value={zone}
          onChange={onZoneChange}
        />
      </div>
    </header>
  )
}
