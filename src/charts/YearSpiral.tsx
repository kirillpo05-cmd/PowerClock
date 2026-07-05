import { useEffect, useState } from 'react'
import { formatCt, type PriceColorScale } from '../lib/scales'
import type { TooltipHandler } from './tooltip'

const SIZE = 480
const CX = SIZE / 2
const CY = SIZE / 2
const R0 = 72
const R = 186
const TAU = Math.PI * 2
const GAP = 0.03 // radians trimmed at both ends of each month arc
const SAMPLES = 10

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/** Point on the one-turn Archimedean spiral; frac ∈ [0..1] over the year. */
function spiralPoint(frac: number): [number, number] {
  const a = frac * TAU
  const r = R0 + (R - R0) * frac
  return [CX + r * Math.sin(a), CY - r * Math.cos(a)]
}

function monthPath(m: number): string {
  const from = m / 12 + GAP / TAU
  const to = (m + 1) / 12 - GAP / TAU
  const pts = Array.from({ length: SAMPLES + 1 }, (_, i) => {
    const [x, y] = spiralPoint(from + ((to - from) * i) / SAMPLES)
    return `${x.toFixed(2)},${y.toFixed(2)}`
  })
  return `M ${pts.join(' L ')}`
}

type Props = {
  byMonth: { month: number; avg: number | null }[]
  scale: PriceColorScale
  onTooltip: TooltipHandler
}

/** 12 month arcs on a spiral: January at top-center, radius = time, color = price. */
export default function YearSpiral({ byMonth, scale, onTooltip }: Props) {
  // Draw-in via stroke-dashoffset (SPEC §5.4); reduced-motion is handled by
  // the global CSS override that kills transitions.
  const [drawn, setDrawn] = useState(false)
  useEffect(() => {
    const raf = requestAnimationFrame(() => setDrawn(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className="w-full"
      role="img"
      aria-label="Yearly price spiral by month"
      onMouseLeave={() => onTooltip(null)}
    >
      {byMonth.map(({ month, avg }, m) => (
        <path
          key={month}
          className="bar anim"
          d={monthPath(m)}
          fill="none"
          stroke={avg === null ? 'var(--surface-2)' : scale.color(avg)}
          strokeWidth={18}
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={drawn ? 0 : 1}
          style={{ transition: `stroke-dashoffset 600ms cubic-bezier(0.22, 1, 0.36, 1) ${m * 45}ms` }}
          onMouseMove={(ev) =>
            onTooltip({
              x: ev.clientX,
              y: ev.clientY,
              title: MONTHS[m] ?? '',
              value: avg === null ? 'no data' : `avg ${formatCt(avg)} ct/kWh`,
            })
          }
        />
      ))}

      {/* month labels just outside each arc */}
      {byMonth.map(({ month, avg }, m) => {
        const frac = (m + 0.5) / 12
        const a = frac * TAU
        const r = R0 + (R - R0) * frac + 26
        return (
          <text
            key={month}
            x={CX + r * Math.sin(a)}
            y={CY - r * Math.cos(a)}
            textAnchor="middle"
            dominantBaseline="central"
            fill="var(--muted)"
            fontSize={10}
            opacity={avg === null ? 0.45 : 1}
          >
            {MONTHS[m]?.slice(0, 3)}
          </text>
        )
      })}
    </svg>
  )
}
