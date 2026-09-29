import { describe, expect, it } from 'vitest'
import { formatLongDate, formatShortDate, fromSiteClock, isIsoDate, siteToday, toSiteClock } from './dates'

describe('siteToday', () => {
  it('uses London time, not UTC', () => {
    // 23:30 UTC on 24 Oct is already 25 Oct in London, which is still on BST (UTC+1).
    expect(siteToday(new Date('2026-10-24T23:30:00Z'))).toBe('2026-10-25')
    // In winter, London and UTC agree.
    expect(siteToday(new Date('2026-11-05T23:30:00Z'))).toBe('2026-11-05')
  })
})

describe('isIsoDate', () => {
  it('accepts real dates only', () => {
    expect(isIsoDate('2026-11-05')).toBe(true)
    expect(isIsoDate('2026-02-30')).toBe(false)
    expect(isIsoDate('5 Nov')).toBe(false)
    expect(isIsoDate('2026-11-5')).toBe(false)
  })
})

describe('formatting', () => {
  it('formats short and long dates', () => {
    expect(formatShortDate('2026-11-05')).toBe('Thu 5 Nov')
    expect(formatLongDate('2026-11-05')).toBe('Thursday 5 November')
  })
})

describe('London clock time', () => {
  it('reads a timestamp as London time, in summer and winter', () => {
    expect(toSiteClock('2026-10-01T17:00:00Z')).toBe('2026-10-01T18:00')
    expect(toSiteClock('2026-11-01T18:00:00Z')).toBe('2026-11-01T18:00')
  })

  it('turns London time back into a timestamp', () => {
    expect(fromSiteClock('2026-10-01T18:00')).toBe('2026-10-01T17:00:00.000Z')
    expect(fromSiteClock('2026-11-01T18:00')).toBe('2026-11-01T18:00:00.000Z')
  })

  it('handles times right after the clocks go back', () => {
    // Clocks go back at 02:00 BST on 25 Oct 2026; 03:00 is GMT.
    expect(fromSiteClock('2026-10-25T03:00')).toBe('2026-10-25T03:00:00.000Z')
    expect(fromSiteClock('2026-10-25T00:30')).toBe('2026-10-24T23:30:00.000Z')
  })
})
