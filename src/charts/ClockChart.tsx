import { arc } from 'd3'
import type { HourPrice } from '../lib/loader'
import { formatCt, hourRange, type PriceColorScale } from '../lib/scales'
import type { TooltipHandler } from './tooltip'
import { useEntryProgress } from './useEntryProgress'

const SIZE = 480
const CX = SIZE / 2
const CY = SIZE / 2
const R = 196
const R0 = 76 // ≈38% of R (SPEC §2.4)
const TAU = Math.PI * 2
const PAD = 0.012 // angular gap between bars, radians
const MIN_BAR = 4 // px, so an all-equal day still shows bars (SPEC §2.6)

const hourArc = arc<{ outer: number; hour: number }>()
  .innerRadius(R0)
  .outerRadius((d) => d.outer)
  .startAngle((d) => (d.hour / 24) * TAU + PAD / 2)
  .endAngle((d) => ((d.hour + 1) / 24) * TAU - PAD / 2)
  .cornerRadius(3)

/** d3 angle convention: 0 at 12 o'clock, clockwise. */
function polar(angle: number, r: number): [number, number] {
  return [CX + r * Math.sin(angle), CY - r * Math.cos(angle)]
}

type Props = {
  entries: HourPrice[]
  /** Riga hour to highlight; null when the shown day is not today. */
  currentHour: number | null
  scale: PriceColorScale
  /** Shared across today/tomorrow so toggling compares days honestly (SPEC §2.5). */
  lengthDomain: [number, number]
  onTooltip: TooltipHandler
}

export default function ClockChart({ entries, currentHour, scale, lengthDomain, onTooltip }: Props) {
  const progress = useEntryProgress()
  const [lo, hi] = lengthDomain
  const norm = (v: number) => (hi === lo ? 1 : (v - lo) / (hi - lo))
  const barLength = (v: number) => Math.max(MIN_BAR, (R - R0) * norm(v))

  const byHour = new Map(entries.map((e) => [e.hour, e]))
  const current = currentHour !== null ? byHour.get(currentHour) : undefined
  const needleAngle = currentHour !== null ? ((currentHour + 0.5) / 24) * TAU : null

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className="w-full"
      role="img"
      aria-label="24-hour price clock"
      onMouseLeave={() => onTooltip(null)}
    >
      {/* subtle inner guide */}
      <circle cx={CX} cy={CY} r={R0 - 6} fill="none" stroke="var(--surface-2)" />

      {entries.map((e) => {
        // Stagger: each bar grows during its slice of the shared eased progress.
        const local = Math.min(1, Math.max(0, progress * 1.55 - (e.hour / 24) * 0.55))
        const outer = R0 + barLength(e.price) * local
        const isCurrent = currentHour === e.hour
        return (
          <path
            key={e.hour}
            className="bar"
            d={hourArc({ outer, hour: e.hour }) ?? undefined}
            transform={`translate(${CX} ${CY})`}
            fill={scale.color(e.price)}
            stroke={isCurrent ? 'var(--accent)' : 'none'}
            strokeWidth={isCurrent ? 2.5 : 0}
            onMouseMove={(ev) =>
              onTooltip({
                x: ev.clientX,
                y: ev.clientY,
                title: hourRange(e.hour),
                value: `${formatCt(e.price)} ct/kWh`,
              })
            }
          />
        )
      })}

      {/* current-hour needle */}
      {needleAngle !== null && current && (
        <line
          x1={CX}
          y1={CY}
          x2={polar(needleAngle, R0 - 10)[0]}
          y2={polar(needleAngle, R0 - 10)[1]}
          stroke="var(--accent)"
          strokeWidth={2}
          strokeLinecap="round"
          opacity={progress}
        />
      )}

      {/* hour labels */}
      {[0, 3, 6, 9, 12, 15, 18, 21].map((h) => {
        const [x, y] = polar((h / 24) * TAU, R + 18)
        return (
          <text
            key={h}
            x={x}
            y={y}
            textAnchor="middle"
            dominantBaseline="central"
            fill="var(--muted)"
            fontSize={12}
          >
            {String(h).padStart(2, '0')}
          </text>
        )
      })}

      {/* center readout — only meaningful on the "today" view */}
      {current ? (
        <g opacity={progress}>
          <text
            x={CX}
            y={CY - 6}
            textAnchor="middle"
            fill="var(--text)"
            fontSize={38}
            fontWeight={600}
          >
            {formatCt(current.price)}
          </text>
          <text x={CX} y={CY + 22} textAnchor="middle" fill="var(--muted)" fontSize={12}>
            ct/kWh now
          </text>
        </g>
      ) : (
        <text x={CX} y={CY + 4} textAnchor="middle" fill="var(--muted)" fontSize={13}>
          24 h
        </text>
      )}
    </svg>
  )
}
