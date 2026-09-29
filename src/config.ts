// Everything specific to one organisation. To reuse the app elsewhere, change these values, plus the
// matching database settings: private.allowed_email_domain() and private.site_time_zone() (see README).

export const SITE = {
  // Shown in the header, sign-in screen and browser tab.
  name: 'Astronomy Society',
  appName: 'Room booking',

  // Only name@<emailDomain> can sign in. The database enforces the same rule.
  emailDomain: 'university.example',
  emailLabel: 'Your university email',
  emailExample: 'a.student@university.example',

  // Who people should ask for help, e.g. "Questions or problems? Speak to the committee."
  contact: 'the committee',

  // Dates, "today" and calendar times are all in this time zone.
  timeZone: 'Europe/London',

  // Every session's start and end, used for calendar files.
  sessionStart: { hour: 19, minute: 0 },
  sessionEnd: { hour: 21, minute: 30 },

  // Calendar event details.
  eventTitle: 'Astronomy Society session',
  venue: 'Harcourt Building',
  // Domain part of calendar event IDs, so re-importing updates events instead of duplicating them.
  calendarIdDomain: 'room-booking.example',
} as const
