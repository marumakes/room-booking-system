// Calendar file (.ics) for a host's sessions, importable into Google, Apple and Outlook calendars.
import { SITE } from '../config'
import type { MySession } from './rooms'

// RFC 5545 requires CRLF line endings.
const CRLF = '\r\n'

// Minutes the site's time zone is ahead of UTC on that date, e.g. 60 in UK summer time, 0 in winter.
function siteOffsetMinutes(isoDate: string): number {
  const noonUtc = new Date(`${isoDate}T12:00:00Z`)
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: SITE.timeZone,
    hour: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(noonUtc)
  const siteHour = Number(parts.find((p) => p.type === 'hour')!.value)
  return (siteHour - noonUtc.getUTCHours()) * 60
}

// A wall-clock time on a date in the site's time zone, as an iCalendar UTC timestamp, e.g. 20261105T190000Z.
export function siteTimeAsUtc(isoDate: string, time: { hour: number; minute: number }): string {
  const asIfUtc = Date.UTC(
    Number(isoDate.slice(0, 4)),
    Number(isoDate.slice(5, 7)) - 1,
    Number(isoDate.slice(8, 10)),
    time.hour,
    time.minute,
  )
  const utc = new Date(asIfUtc - siteOffsetMinutes(isoDate) * 60_000)
  return formatUtc(utc)
}

function formatUtc(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

// Escapes text values: backslash, comma, semicolon and newlines are special in iCalendar.
function escapeText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

// One event per session. Re-importing updates rather than duplicates, thanks to the stable UID.
export function buildCalendar(sessions: MySession[], now: Date = new Date()): string {
  const stamp = formatUtc(now)
  const events = sessions.flatMap((s) => [
    'BEGIN:VEVENT',
    `UID:${s.sessionId}@${SITE.calendarIdDomain}`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${siteTimeAsUtc(s.date, SITE.sessionStart)}`,
    `DTEND:${siteTimeAsUtc(s.date, SITE.sessionEnd)}`,
    `SUMMARY:${escapeText(`${SITE.eventTitle} – ${s.room}`)}`,
    `LOCATION:${escapeText(`${s.room}, ${SITE.venue}`)}`,
    'END:VEVENT',
  ])

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//${SITE.name}//${SITE.appName}//EN`,
    'CALSCALE:GREGORIAN',
    ...events,
    'END:VCALENDAR',
    '',
  ].join(CRLF)
}

export const CALENDAR_FILE_NAME = 'sessions.ics'
export const CALENDAR_MIME_TYPE = 'text/calendar;charset=utf-8'
