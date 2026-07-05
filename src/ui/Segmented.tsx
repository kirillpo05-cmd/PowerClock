export type SegmentOption<T extends string> = {
  value: T
  label: string
  disabled?: boolean
  hint?: string
}

type Props<T extends string> = {
  options: SegmentOption<T>[]
  value: T
  onChange: (value: T) => void
  ariaLabel: string
}

export function Segmented<T extends string>({ options, value, onChange, ariaLabel }: Props<T>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="inline-flex rounded-full bg-surface-2 p-1 text-sm"
    >
      {options.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            role="tab"
            aria-selected={active}
            disabled={opt.disabled}
            title={opt.hint}
            onClick={() => onChange(opt.value)}
            className={`rounded-full px-3 py-1 transition-colors ${
              active
                ? 'bg-surface font-semibold text-accent'
                : opt.disabled
                  ? 'cursor-not-allowed text-muted opacity-50'
                  : 'text-muted hover:text-text'
            }`}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
