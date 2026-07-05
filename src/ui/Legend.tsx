import { useId } from 'react'
import { formatCt, type PriceColorScale } from '../lib/scales'

const STOPS = 24

/** Shared cheap→expensive gradient legend with exact domain bounds in ct/kWh. */
export function Legend({ scale, note }: { scale: PriceColorScale; note?: string }) {
  const gradientId = useId()
  const [lo, hi] = scale.domain

  return (
    <div>
      <div className="flex items-center gap-3 text-xs text-muted">
        <span>{formatCt(lo)}</span>
        <svg className="h-2.5 min-w-0 flex-1" aria-hidden="true">
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
              {Array.from({ length: STOPS + 1 }, (_, i) => (
                <stop
                  key={i}
                  offset={`${(i / STOPS) * 100}%`}
                  stopColor={scale.color(lo + ((hi - lo) * i) / STOPS)}
                />
              ))}
            </linearGradient>
          </defs>
          <rect width="100%" height="100%" rx="5" fill={`url(#${gradientId})`} />
        </svg>
        <span>{formatCt(hi)} ct/kWh</span>
      </div>
      {note && <p className="mt-1.5 text-center text-[11px] text-muted">{note}</p>}
    </div>
  )
}
