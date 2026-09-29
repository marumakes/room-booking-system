import { Link } from 'react-router'
import { formatShortDate } from '../domain/dates'
import { ClaimMode, type MySession } from '../domain/rooms'
import { cardClass, pillButtonClass, secondaryButtonClass } from './Screen'

type YourSessionsProps = {
  sessions: MySession[]
  today: string
  onRelease: (sessionId: string) => void
  onCalendar: () => void
}

// Collapsible list of the host's claims, each linking to its week, with release and calendar download.
export function YourSessions({ sessions, today, onRelease, onCalendar }: YourSessionsProps) {
  const upcoming = sessions.filter((s) => s.date >= today)

  return (
    <details className={`${cardClass} group`}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 [&::-webkit-details-marker]:hidden">
        <span>
          <span className="block font-semibold">Your sessions ({sessions.length})</span>
          <span className="block text-sm text-muted">
            {upcoming.length === 0 ? 'Nothing coming up' : `Next: ${formatShortDate(upcoming[0].date)} · ${upcoming[0].room}`}
          </span>
        </span>
        <svg aria-hidden="true" viewBox="0 0 16 16" className="size-5 shrink-0 text-muted transition group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M4 6l4 4 4-4" />
        </svg>
      </summary>

      {sessions.length === 0 ? (
        <p className="mt-4 text-sm text-muted">You haven’t claimed any rooms yet.</p>
      ) : (
        <>
          <ul className="mt-4 divide-y divide-line">
            {sessions.map((s) => (
              <li key={s.sessionId} className="flex items-center justify-between gap-3 py-3">
                <span>
                  <Link to={`/${s.day}?week=${s.date}`} className="font-medium underline decoration-line-strong underline-offset-4 hover:decoration-ink">
                    {formatShortDate(s.date)} · {s.room}
                  </Link>
                  {s.mode === ClaimMode.Quiet && <span className="block text-sm text-muted">Quiet room</span>}
                </span>
                {s.date >= today && (
                  <button
                    type="button"
                    className={pillButtonClass}
                    onClick={() => onRelease(s.sessionId)}
                    aria-label={`Release ${s.room} on ${formatShortDate(s.date)}`}
                  >
                    Release
                  </button>
                )}
              </li>
            ))}
          </ul>
          {upcoming.length > 0 && (
            <button type="button" className={`${secondaryButtonClass} sm:w-auto`} onClick={onCalendar}>
              Add all to calendar
            </button>
          )}
        </>
      )}
    </details>
  )
}
