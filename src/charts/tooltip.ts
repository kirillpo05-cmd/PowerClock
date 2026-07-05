/** Payload charts hand to the App-level tooltip. */
export type TooltipInfo = {
  x: number // clientX
  y: number // clientY
  title: string
  value: string
}

export type TooltipHandler = (info: TooltipInfo | null) => void
