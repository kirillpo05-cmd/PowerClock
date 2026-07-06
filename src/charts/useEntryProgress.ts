import { useEffect, useState } from 'react'

/**
 * Eased 0→1 progress for entry animations (SPEC: 400–600 ms ease-out, played
 * on mount). Honors prefers-reduced-motion by starting at 1.
 *
 * Note: no "already started" guard here — React StrictMode (dev) runs the
 * effect as setup → cleanup → setup, and a guard would leave the animation
 * cancelled by the cleanup and never restarted, freezing every chart at
 * progress 0. The empty dep array alone already limits it to mount.
 */
export function useEntryProgress(duration = 550): number {
  const [progress, setProgress] = useState(() =>
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ? 1
      : 0,
  )

  useEffect(() => {
    if (progress === 1) return // reduced motion — nothing to animate
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
