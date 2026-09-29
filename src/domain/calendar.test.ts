import { describe, expect, it } from 'vitest'
import { buildCalendar, siteTimeAsUtc } from './calendar'
import { ClaimMode, DayType } from './rooms'

// The site's time zone is Europe/London (src/config.ts); sessions run 19:00–21:30.
const START = { hour: 19, minute: 0 }

describe('siteTimeAsUtc', () => {
  it('converts local time to UTC in summer time', () => {
    expect(siteTimeAsUtc('2026-10-22', START)).toBe('20261022T180000Z')
  })

  it('converts local time to UTC in winter', () => {
    expect(siteTimeAsUtc('2026-11-05', START)).toBe('20261105T190000Z')
  })
})

describe('buildCalendar', () => {
  const ics = buildCalendar(
    [{ sessionId: 'abc', date: '2026-11-05', day: DayType.Thursday, room: 'Harcourt 1.04', mode: ClaimMode.Shared }],
    new Date('2026-09-24T12:00:00Z'),
  )

  it('uses CRLF line endings and wraps events in a calendar', () => {
    expect(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n')).toBe(true)
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true)
  })

  it('describes each session with a stable ID, the configured times, title and escaped location', () => {
    const lines = ics.split('\r\n')
    expect(lines).toContain('UID:abc@room-booking.example')
    expect(lines).toContain('DTSTART:20261105T190000Z')
    expect(lines).toContain('DTEND:20261105T213000Z')
    expect(lines).toContain('SUMMARY:Astronomy Society session – Harcourt 1.04')
    expect(lines).toContain('LOCATION:Harcourt 1.04\\, Harcourt Building')
    expect(lines).toContain('DTSTAMP:20260924T120000Z')
  })
})
