import { useState, type FormEvent, type ReactNode } from 'react'
import { ClaimFailure, canClaim, roomDates, seriesOption, type ClaimResult, type SeriesResult } from '../domain/claims'
import { formatLongDate, formatShortDate } from '../domain/dates'
import { ClaimMode, type RoomsData, type Session } from '../domain/rooms'
import { CLAIM_FAILURE_MESSAGES, QUIET_WARNING, conflictMessage, weeks } from './messages'
import { NoticeKind, type Notice } from './notice'
import { useRepos } from './repos'
import { ErrorText, primaryButtonClass, switchClass, warningClass } from './Screen'
import { Sheet } from './Sheet'

// Failures that mean the grid was out of date: close the sheet and refresh instead of retrying here.
const STALE_FAILURES = new Set<ClaimFailure>([
  ClaimFailure.RoomFull,
  ClaimFailure.RoomTaken,
  ClaimFailure.AlreadyClaimed,
  ClaimFailure.BookedTonight,
  ClaimFailure.SessionNotFound,
  ClaimFailure.SessionUnavailable,
  ClaimFailure.ClaimsClosed,
])

type ClaimSheetProps = {
  data: RoomsData
  session: Session
  myId: string
  today: string
  partTerm: boolean
  onClose: () => void
  onDone: (notice: Notice) => void
  // Shown below the main content, e.g. committee's clear options.
  extra?: ReactNode
}

// Claim a room for one night (or every week): shared or quiet, with the relevant warnings.
export function ClaimSheet({ data, session, myId, today, partTerm, onClose, onDone, extra }: ClaimSheetProps) {
  const { claims: claimsRepo } = useRepos()
  const quietPossible = canClaim(data, session, myId, ClaimMode.Quiet, today)
  const [mode, setMode] = useState<ClaimMode>(ClaimMode.Shared)
  const [everyWeek, setEveryWeek] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const series = seriesOption(data, session.room, session.day, mode, myId, today)
  const claimingSeries = everyWeek && series.available

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    const result: SeriesResult | ClaimResult = claimingSeries
      ? await claimsRepo.claimSeries(session.room, session.day, mode)
      : await claimsRepo.claimSlot(session.id, mode)
    setBusy(false)

    if (result.ok) {
      const what = claimingSeries && series.available ? `every week (${weeks(series.weeks)})` : `on ${formatShortDate(session.date)}`
      const quiet = mode === ClaimMode.Quiet ? ' as a quiet room' : ''
      onDone({ kind: NoticeKind.Success, text: `Claimed ${session.room}${quiet} ${what}.`, offerCalendar: true })
      return
    }

    if ('conflicts' in result) {
      onDone({ kind: NoticeKind.Error, text: conflictMessage(result.conflicts) })
      return
    }

    if (STALE_FAILURES.has(result.failure)) {
      onDone({ kind: NoticeKind.Error, text: CLAIM_FAILURE_MESSAGES[result.failure] })
      return
    }

    setError(CLAIM_FAILURE_MESSAGES[result.failure])
  }

  return (
    <Sheet title={`Claim ${session.room}`} subtitle={formatLongDate(session.date)} onClose={onClose}>
      <form onSubmit={onSubmit}>
        <fieldset>
          <legend className="mb-3 font-medium">How do you want the room?</legend>

          <label className="flex cursor-pointer gap-3 rounded-2xl bg-sunk p-4 ring-2 ring-transparent transition has-checked:bg-surface has-checked:ring-ink">
            <input
              type="radio"
              name="mode"
              checked={mode === ClaimMode.Shared}
              onChange={() => setMode(ClaimMode.Shared)}
            />
            <span>
              <span className="block font-medium">Share the room</span>
              <span className="text-sm text-muted">Up to 2 hosts and their groups.</span>
            </span>
          </label>

          <label className="mt-2.5 flex cursor-pointer gap-3 rounded-2xl bg-sunk p-4 ring-2 ring-transparent transition has-checked:bg-surface has-checked:ring-ink has-disabled:cursor-not-allowed has-disabled:opacity-60">
            <input
              type="radio"
              name="mode"
              checked={mode === ClaimMode.Quiet}
              disabled={!quietPossible}
              onChange={() => setMode(ClaimMode.Quiet)}
            />
            <span>
              <span className="block font-medium">Quiet room</span>
              <span className="text-sm text-muted">
                {quietPossible ? 'The whole room for your group.' : 'Not available: another host is already in this room.'}
              </span>
            </span>
          </label>
        </fieldset>

        {mode === ClaimMode.Quiet && (
          <p className={`mt-4 ${warningClass}`}>
            {QUIET_WARNING}
          </p>
        )}

        {partTerm && (
          <div className={`mt-4 ${warningClass}`}>
            <p className="font-medium">Not available every week</p>
            <p>This room is only booked on: {roomDates(data, session.room, session.day).map(formatShortDate).join(', ')}.</p>
          </div>
        )}

        {series.available && (
          <label className="mt-4 flex cursor-pointer items-center justify-between gap-3 rounded-2xl bg-sunk p-4">
            <span>
              <span className="block font-medium">Every week ({weeks(series.weeks)})</span>
              <span className="block text-sm text-muted">Claim this room for every remaining week.</span>
            </span>
            <input type="checkbox" className={switchClass} checked={everyWeek} onChange={(e) => setEveryWeek(e.target.checked)} />
          </label>
        )}

        <ErrorText message={error} />
        <button type="submit" className={primaryButtonClass} disabled={busy}>
          {busy ? 'Claiming…' : claimingSeries ? `Claim ${weeks(series.weeks)}` : 'Claim'}
        </button>
      </form>
      {extra}
    </Sheet>
  )
}
