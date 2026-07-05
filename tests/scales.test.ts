import { describe, expect, it } from 'vitest'
import { formatCt, hourRange, makePriceColorScale, percentile, toCtKwh } from '../src/lib/scales'

describe('unit conversion', () => {
  it('EUR/MWh → ct/kWh is ÷10', () => {
    expect(toCtKwh(105)).toBe(10.5)
    expect(toCtKwh(-5)).toBe(-0.5)
  })

  it('formats one decimal', () => {
    expect(formatCt(21.4)).toBe('2.1')
    expect(formatCt(0)).toBe('0.0')
  })
})

describe('hourRange', () => {
  it('formats the interval and wraps 23→00', () => {
    expect(hourRange(7)).toBe('07:00–08:00')
    expect(hourRange(23)).toBe('23:00–00:00')
  })
})

describe('percentile', () => {
  it('interpolates linearly', () => {
    expect(percentile([0, 10], 0.5)).toBe(5)
    expect(percentile([1, 2, 3, 4, 5], 0.25)).toBe(2)
  })

  it('handles unsorted input and empty samples', () => {
    expect(percentile([5, 1, 3], 1)).toBe(5)
    expect(Number.isNaN(percentile([], 0.5))).toBe(true)
  })
})

describe('makePriceColorScale', () => {
  it('clamps outside the p10–p90 domain', () => {
    const { color, domain } = makePriceColorScale([0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100])
    expect(color(-999)).toBe(color(domain[0]))
    expect(color(9999)).toBe(color(domain[1]))
  })

  it('survives a degenerate all-equal sample', () => {
    const { domain } = makePriceColorScale([50, 50, 50])
    expect(domain).toEqual([49, 51])
  })

  it('survives an empty sample', () => {
    const { color } = makePriceColorScale([])
    expect(typeof color(10)).toBe('string')
  })
})
