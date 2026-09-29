import { SITE } from '../config'
import { AuthFailure } from '../domain/auth'
import { ClaimFailure } from '../domain/claims'
import { formatDateTime, formatShortDate } from '../domain/dates'
import { ClaimAction, type HistoryEntry } from '../domain/history'
import { DISPLAY_NAME_MAX_LENGTH, DisplayNameProblem } from '../domain/displayName'
import { DataFailure } from '../domain/failure'
import { ProfileFailure } from '../domain/profile'
import { CellKind, ClaimMode, DayType, type CellView } from '../domain/rooms'
import { ThemeMode } from '../domain/theme'

// Every user-facing string that depends on state, in plain words.

export const NOT_ALLOWED_EMAIL_MESSAGE = `Use your university email address, ending in @${SITE.emailDomain}.`

export const AUTH_FAILURE_MESSAGES: Record<AuthFailure, string> = {
  [AuthFailure.NotAllowedEmail]: NOT_ALLOWED_EMAIL_MESSAGE,
  [AuthFailure.CodeInvalid]: 'That code is wrong or has expired. Check the latest email, or send a new code.',
  [AuthFailure.RateLimited]: 'Too many attempts. Wait a minute, then try again.',
  [AuthFailure.Network]: 'Can’t reach the server. Check your connection and try again.',
  [AuthFailure.Unknown]: `Something went wrong. Try again, and speak to ${SITE.contact} if it keeps happening.`,
}

export const DATA_FAILURE_MESSAGES: Record<DataFailure, string> = {
  [DataFailure.Network]: AUTH_FAILURE_MESSAGES[AuthFailure.Network],
  [DataFailure.Unknown]: AUTH_FAILURE_MESSAGES[AuthFailure.Unknown],
}

export const PROFILE_FAILURE_MESSAGES: Record<ProfileFailure, string> = {
  ...DATA_FAILURE_MESSAGES,
  [ProfileFailure.NameTaken]: 'Another host already uses that name. Try adding an initial.',
}

// Why a claim or release didn't happen. The "taken" ones refresh the grid so it's current.
export const CLAIM_FAILURE_MESSAGES: Record<ClaimFailure, string> = {
  ...DATA_FAILURE_MESSAGES,
  [ClaimFailure.NotSignedIn]: 'You’ve been signed out. Sign in again to claim a room.',
  [ClaimFailure.EmailNotAllowed]: NOT_ALLOWED_EMAIL_MESSAGE,
  [ClaimFailure.ProfileMissing]: 'Set a display name before claiming a room.',
  [ClaimFailure.SessionNotFound]: 'That session no longer exists. The rooms have been refreshed.',
  [ClaimFailure.SessionUnavailable]: 'That room has been cancelled for this week.',
  [ClaimFailure.SessionPast]: 'That session has already happened.',
  [ClaimFailure.AlreadyClaimed]: 'You already have a space in that room.',
  [ClaimFailure.BookedTonight]: 'You already have a room that night. Release it first if you want to switch.',
  [ClaimFailure.RoomTaken]: 'Someone else is already in that room, so it can’t be a quiet room.',
  [ClaimFailure.RoomFull]: 'Someone just took the last space in that room. The rooms have been refreshed.',
  [ClaimFailure.NotEveryWeek]: 'That room isn’t booked every week, so it can only be claimed one week at a time.',
  [ClaimFailure.NothingToClaim]: 'You already hold every remaining week of that room.',
  [ClaimFailure.NotCommittee]: 'Only the committee can do that.',
  [ClaimFailure.ClaimsClosed]: `Sign-up has closed, so rooms can’t be changed here any more. Speak to ${SITE.contact} about changes.`,
}

// The closing time, e.g. "Sign-up closes Thu 1 Oct, 18:00." or, once passed, "Sign-up closed …".
export function closingText(closesAt: string, closed: boolean): string {
  return closed ? `Sign-up closed ${formatDateTime(closesAt)}.` : `Sign-up closes ${formatDateTime(closesAt)}.`
}

// Multi-book refused because some weeks were taken meanwhile; nothing was claimed.
export function conflictMessage(dates: string[]): string {
  return `Some weeks were taken in the meantime (${dates.map(formatShortDate).join(', ')}), so nothing was booked. The rooms have been refreshed.`
}

// Shown when a host tries to claim a second room on a night they already have one.
export function mineTonightText(room: string): string {
  return `You already have ${room} on this night. Hosts can have one room per night, so release that room first if you’d like to switch.`
}

// Footer on every screen.
export const HELP_TEXT = `Questions or problems? Speak to ${SITE.contact}.`

// After closing, where hosts go for changes.
export const CLOSED_HELP_TEXT = `Speak to ${SITE.contact} about changes.`

export const QUIET_WARNING =
  'Quiet rooms aren’t guaranteed. If rooms get tight, the committee may get in touch to ask you to share.'

export const DISPLAY_NAME_MESSAGES: Record<DisplayNameProblem, string> = {
  [DisplayNameProblem.Empty]: 'Enter a name.',
  [DisplayNameProblem.TooLong]: `Keep it to ${DISPLAY_NAME_MAX_LENGTH} characters or fewer.`,
}

export const DAY_LABELS: Record<DayType, string> = {
  [DayType.Monday]: 'Monday',
  [DayType.Tuesday]: 'Tuesday',
  [DayType.Wednesday]: 'Wednesday',
  [DayType.Thursday]: 'Thursday',
  [DayType.Friday]: 'Friday',
  [DayType.Saturday]: 'Saturday',
  [DayType.Sunday]: 'Sunday',
}

export const THEME_LABELS: Record<ThemeMode, string> = {
  [ThemeMode.System]: 'Device',
  [ThemeMode.Light]: 'Light',
  [ThemeMode.Dark]: 'Dark',
}

function spaces(count: number): string {
  return count === 1 ? '1 space' : `${count} spaces`
}

// "1 week", "3 weeks".
export function weeks(count: number): string {
  return count === 1 ? '1 week' : `${count} weeks`
}

// What a room slot says, e.g. "Alex · 1 space" or "You (quiet room)". Never relies on colour alone.
export function cellText(view: CellView): string {
  switch (view.kind) {
    case CellKind.NotBooked:
      return 'Not booked'

    case CellKind.Open:
      return view.others.length > 0 ? `${view.others.join(', ')} · ${spaces(view.spacesLeft)}` : spaces(view.spacesLeft)

    case CellKind.Mine:
      if (view.mode === ClaimMode.Quiet) {
        return 'You (quiet room)'
      }

      return view.others.length > 0 ? `You · ${view.others.join(', ')}` : 'You · 1 space left'

    case CellKind.Full:
      return view.names.join(' · ')

    case CellKind.Quiet:
      return `${view.name} (quiet room)`
  }
}

// One history line, e.g. "Cora cleared Sam’s claim" or "Sam claimed (quiet room)".
export function historyText(entry: HistoryEntry): string {
  const quiet = entry.mode === ClaimMode.Quiet ? ' (quiet room)' : ''

  switch (entry.action) {
    case ClaimAction.Claimed:
      return `${entry.ownerName} claimed${quiet}`

    case ClaimAction.Released:
      return `${entry.ownerName} released${quiet}`

    case ClaimAction.Cleared:
      return `${entry.actorName ?? 'Committee'} cleared ${entry.ownerName}’s claim${quiet}`

    case ClaimAction.Removed:
      return `${entry.ownerName}’s claim was removed with their account${quiet}`
  }
}
