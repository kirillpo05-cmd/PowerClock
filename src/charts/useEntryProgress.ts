import { useEffect, useRef, useState } from 'react'

/**
 * Eased 0→1 progress that runs once on mount (entry animations, SPEC:
 * 400–600 ms ease-out, played only on first render). Honors
 * prefers-reduced-motion by starting at 1.
 */
export function useEntryProgress(duration = 550): number {
  const [progress, setProgress] = useState(() =>
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ? 1
      : 0,
  )
  const started = useRef(false)

  useEffect(() => {
    if (started.current || progress === 1) return
    started.current = true
    let raf = 0
    const start = performance.now()
    const tick = (t: number) => {
      const x = Math.min(1, (t - start) / duration)
      setProgress(1 - Math.pow(1 - x, 3)) // cubic ease-out
      if (x < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return progress
}
