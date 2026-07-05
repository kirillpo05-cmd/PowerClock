import { arc } from 'd3'
import { formatCt, hourRange, type PriceColorScale } from '../lib/scales'
import type { TooltipHandler } from './tooltip'
import { useEntryProgress } from './useEntryProgress'

const SIZE = 480
const CX = SIZE / 2
const CY = SIZE / 2
const R = 196
const R0 = 66
const TAU = Math.PI * 2
const STEP = (R - R0) / 7
const RING_GAP = 2
const PAD = 0.008

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

const cellArc = arc<{ w: number; h: number }>()
  .innerRadius((d) => R0 + d.w * STEP)
  .outerRadius((d) => R0 + (d.w + 1) * STEP - RING_GAP)
  .startAngle((d) => (d.h / 24) * TAU + PAD / 2)
  .endAngle((d) => ((d.h + 1) / 24) * TAU - PAD / 2)

type Props = {
  /** avg price [7][24], Mon=0 — nulls where no observations. */
  matrix: (number | null)[][]
  windowDays: number
  scale: PriceColorScale
  onTooltip: TooltipHandler
}

/** 7 rings (Mon innermost) × 24 sectors, 00:00 at top, clockwise. */
export default function WeekRing({ matrix, windowDays, scale, onTooltip }: Props) {
  const progress = useEntryProgress(600)

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className="w-full"
      role="img"
      aria-label="Weekly price heatmap: weekday rings by hour sectors"
      onMouseLeave={() => onTooltip(null)}
    >
      {matrix.map((row, w) => (
        <g key={w} opacity={Math.min(1, Math.max(0, progress * 8 - w))}>
          {row.map((v, h) => (
            <path
              key={h}
              className="bar"
              d={cellArc({ w, h }) ?? undefined}
              transform={`translate(${CX} ${CY})`}
              fill={v === null ? 'var(--surface-2)' : scale.color(v)}
              onMouseMove={(ev) =>
                onTooltip({
                  x: ev.clientX,
                  y: ev.clientY,
                  title: `${WEEKDAYS[w]} ${hourRange(h)}`,
                  value: v === null ? 'no data' : `avg ${formatCt(v)} ct/kWh (${windowDays} d)`,
                })
              }
            />
          ))}
        </g>
      ))}

      {/* hour labels */}
      {[0, 6, 12, 18].map((h) => {
        const a = (h / 24) * TAU
        const x = CX + (R + 14) * Math.sin(a)
        const y = CY - (R + 14) * Math.cos(a)
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

      {/* weekday letters, on the left, Mon innermost */}
      {LETTERS.map((letter, w) => (
        <text
          key={w}
          x={CX - (R0 + (w + 0.5) * STEP)}
          y={CY}
          textAnchor="middle"
          dominantBaseline="central"
          fill="var(--text)"
          fontSize={10}
          style={{ paintOrder: 'stroke', stroke: 'var(--bg)', strokeWidth: 3 }}
          opacity={progress}
        >
          {letter}
        </text>
      ))}
    </svg>
  )
}
