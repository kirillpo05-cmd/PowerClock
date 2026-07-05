import type { ReactNode } from 'react'
import type { Insight } from '../lib/insights'

type CardProps = {
  title?: string
  subtitle?: string
  action?: ReactNode
  children: ReactNode
  className?: string
}

export function Card({ title, subtitle, action, children, className = '' }: CardProps) {
  return (
    <section className={`rounded-card bg-surface p-5 sm:p-6 ${className}`}>
      {(title || action) && (
        <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            {title && <h2 className="text-base font-semibold">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  )
}

const TONE_COLOR: Record<Insight['tone'], string> = {
  good: 'var(--good)',
  bad: 'var(--bad)',
  neutral: 'var(--text)',
}

export function InsightCard({ insight }: { insight: Insight }) {
  return (
    <section className="rounded-card bg-surface p-5">
      <h3 className="text-xs font-medium tracking-wide text-muted uppercase">{insight.title}</h3>
      <p className="mt-2 text-[28px] leading-none font-semibold" style={{ color: TONE_COLOR[insight.tone] }}>
        {insight.value}
      </p>
      <p className="mt-2 text-sm text-muted">{insight.detail}</p>
    </section>
  )
}
