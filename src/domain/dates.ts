// Session dates are plain calendar dates ("2026-11-05"), always in the site's time zone.
import { SITE } from '../config'

const SITE_TIME_ZONE = SITE.timeZone
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

// en-CA formats dates as YYYY-MM-DD.
const isoInSiteZone = new Intl.DateTimeFormat('en-CA', {
  timeZone: SITE_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

// e.g. "Thu 5 Nov". Formatted in UTC because the ISO date is parsed as UTC midnight.
const shortDate = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'UTC',
  weekday: 'short',
  day: 'numeric',
  month: 'short',
})

// e.g. "Thursday 5 November", for screen readers and headings with room to spare.
const longDate = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'UTC',
  weekday: 'long',
  day: 'numeric',
  month: 'long',
})

// e.g. "Thu 24 Sep, 18:42", for history entries.
const dateTimeInSiteZone = new Intl.DateTimeFormat('en-GB', {
  timeZone: SITE_TIME_ZONE,
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

// Date and time parts in the site's time zone, for the wall-clock helpers below.
const siteParts = new Intl.DateTimeFormat('en-CA', {
  timeZone: SITE_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

// Today's date in the site's time zone, so "next session" flips at local midnight wherever the phone is.
export function siteToday(now: Date = new Date()): string {
  return isoInSiteZone.format(now)
}

// True for a real YYYY-MM-DD date (rejects "2026-02-30").
export function isIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) {
    return false
  }

  const parsed = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value)
}

export function formatShortDate(isoDate: string): string {
  return shortDate.format(new Date(`${isoDate}T00:00:00Z`))
}

export function formatLongDate(isoDate: string): string {
  return longDate.format(new Date(`${isoDate}T00:00:00Z`))
}

// A timestamp (e.g. from the database) in the site's time zone.
export function formatDateTime(timestamp: string): string {
  return dateTimeInSiteZone.format(new Date(timestamp))
}

// A timestamp as clock time in the site's time zone, e.g. "2026-10-01T18:00" (the format of a datetime-local input).
export function toSiteClock(timestamp: string | Date): string {
  const parts = Object.fromEntries(siteParts.formatToParts(new Date(timestamp)).map((p) => [p.type, p.value]))
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`
}

// Clock time in the site's time zone back to a timestamp, e.g. "2026-10-01T18:00" → "2026-10-01T17:00:00.000Z" (BST).
// Guesses with the offset at the clock time, then re-checks at the result in case a clock change lies between.
export function fromSiteClock(clock: string): string {
  const asUtc = Date.parse(`${clock}:00Z`)
  const offsetAt = (instant: number) => Date.parse(`${toSiteClock(new Date(instant))}:00Z`) - instant
  const guess = asUtc - offsetAt(asUtc)
  return new Date(asUtc - offsetAt(guess)).toISOString()
}
