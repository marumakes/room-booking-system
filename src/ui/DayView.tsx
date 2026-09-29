import { useMemo } from 'react'
import { Navigate, useParams, useSearchParams } from 'react-router'
import { formatLongDate, formatShortDate, isIsoDate } from '../domain/dates'
import {
  CellKind,
  cellView,
  claimsBySession,
  isDayType,
  myRoomsByDate,
  partTermRooms,
  resolveWeek,
  roomsForDay,
  sessionDates,
  sessionDays,
  sessionKey,
  sessionsByKey,
  type CellView,
  type DayType,
  type RoomsData,
} from '../domain/rooms'
import { ViewerRole } from '../domain/profile'
import { cellClasses, dotClass, isPast } from './cellStyle'
import { DAY_LABELS, cellText } from './messages'
import { cardClass, eyebrowClass, iconButtonClass } from './Screen'

export const WEEK_PARAM = 'week'
const NOT_EVERY_WEEK = 'Not every week'

// Grid header cells stick just below the site header (h-16) while the page scrolls. The surface-coloured
// halo is as wide as the gaps between cells, so rows scrolling underneath can't show between the room names.
const stickyHeadClass = 'sticky top-16 z-10 bg-surface shadow-[0_0_0_6px_var(--surface)]'

// One room-night in the grid: the cell itself is the rounded tile, so every tile in a row is the same height.
const tileClass = 'relative h-14 rounded-xl p-3 text-left align-top'

type DayViewProps = {
  data: RoomsData
  myId: string
  role: ViewerRole
  today: string
  onSelect: (sessionId: string) => void
}

// One day's rooms. Phones and tablets get one week at a time; wide screens get the whole term as a grid.
// The shown week lives in ?week= so it survives reloads and can be shared.
export function DayView({ data, myId, role, today, onSelect }: DayViewProps) {
  const { day } = useParams()
  const [params, setParams] = useSearchParams()

  // Not a weekday, or a weekday with no sessions while other days have some: go to the default day.
  // (With no sessions at all there's nowhere better to go, so the day says so below.)
  const days = sessionDays(data.sessions)

  if (!isDayType(day) || (days.length > 0 && !days.includes(day))) {
    return <Navigate to="/" replace />
  }

  const dates = sessionDates(data.sessions, day)
  const requested = params.get(WEEK_PARAM)
  const week = resolveWeek(dates, requested && isIsoDate(requested) ? requested : null, today)

  if (!week) {
    return <p>No {DAY_LABELS[day]} sessions are booked this semester.</p>
  }

  // A shared link to a non-session date is corrected in place, not added to history.
  if (requested !== null && requested !== week) {
    return <Navigate to={`/${day}?${WEEK_PARAM}=${week}`} replace />
  }

  const showWeek = (date: string) => setParams({ [WEEK_PARAM]: date })

  return (
    <>
      <div className="xl:hidden">
        <WeekPager {...{ data, day, dates, week, myId, role, today, onSelect }} onWeekChange={showWeek} />
      </div>
      <div className="hidden xl:block">
        <DayGrid {...{ data, day, dates, week, myId, role, today, onSelect }} onWeekChange={showWeek} />
      </div>
    </>
  )
}

type DayPartProps = {
  data: RoomsData
  day: DayType
  dates: string[]
  week: string
  myId: string
  today: string
  onWeekChange: (date: string) => void
  onSelect: (sessionId: string) => void
  role: ViewerRole
}

type Slot = {
  view: CellView
  // Set when tapping the slot does something: claim if there's space, release if it's yours.
  actionId: string | null
}

// Lookups shared by both layouts: cell state by date and room, and which rooms are part-term.
// Committee can also open rooms with other hosts' claims, to clear them.
function useDayLookups(data: RoomsData, day: DayType, myId: string, role: ViewerRole, today: string) {
  return useMemo(() => {
    const byKey = sessionsByKey(data.sessions.filter((s) => s.day === day))
    const claims = claimsBySession(data.claims)
    const myRooms = myRoomsByDate(data, myId)

    const slotAt = (date: string, room: string): Slot => {
      const session = byKey.get(sessionKey(date, room))
      const view = cellView(session, session ? (claims.get(session.id) ?? []) : [], myId, today, myRooms.get(date) ?? null)
      // Open rooms stay tappable even on a night I already have a room; the sheet explains why I can't claim.
      const canClaimOrRelease = view.kind === CellKind.Mine || view.kind === CellKind.Open
      const canClear =
        role === ViewerRole.Committee && !!session && (claims.get(session.id) ?? []).some((c) => c.ownerId !== myId)
      const actionable = (canClaimOrRelease || canClear) && session !== undefined && session.date >= today
      return { view, actionId: actionable ? session.id : null }
    }

    return { rooms: roomsForDay(data.sessions, day), partTerm: partTermRooms(data.sessions, day), slotAt }
  }, [data, day, myId, role, today])
}

// Screen-reader suffix so greyed-out past cells aren't conveyed by colour only.
function PastNote({ view }: { view: CellView }) {
  return isPast(view) ? <span className="sr-only"> (past session)</span> : null
}

// Coloured status dot. Decorative: the text beside it says the same.
function StatusDot({ view }: { view: CellView }) {
  const dot = dotClass(view)
  return dot ? <span aria-hidden="true" className={`mt-1.5 size-2 shrink-0 rounded-full ${dot}`} /> : null
}

// Arrow for the week pager. Decorative: the button has a label.
function Chevron({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d={direction === 'left' ? 'M10 4l-4 4 4 4' : 'M6 4l4 4-4 4'} />
    </svg>
  )
}

// What tapping a slot does, for its button label.
function actionLabel(view: CellView): string {
  if (view.kind === CellKind.Mine) {
    return 'Manage your claim'
  }

  return view.kind === CellKind.Open ? 'Claim' : 'Manage'
}

function WeekPager({ data, day, dates, week, myId, role, today, onWeekChange, onSelect }: DayPartProps) {
  const { rooms, partTerm, slotAt } = useDayLookups(data, day, myId, role, today)
  const index = dates.indexOf(week)
  const previous = dates[index - 1]
  const next = dates[index + 1]

  return (
    <section aria-labelledby="week-heading" className={cardClass}>
      <div className="mb-5 flex items-center justify-between gap-2">
        <button type="button" className={iconButtonClass} onClick={() => onWeekChange(previous)} disabled={!previous} aria-label="Previous week">
          <Chevron direction="left" />
        </button>
        <div className="text-center">
          <p className={eyebrowClass}>
            Week {index + 1} of {dates.length}
          </p>
          <h2 id="week-heading" className="mt-0.5 text-2xl font-semibold tracking-tight">
            <span aria-hidden="true">{formatShortDate(week)}</span>
            <span className="sr-only">{formatLongDate(week)}</span>
          </h2>
        </div>
        <button type="button" className={iconButtonClass} onClick={() => onWeekChange(next)} disabled={!next} aria-label="Next week">
          <Chevron direction="right" />
        </button>
      </div>

      <ul className="grid gap-2.5 md:grid-cols-2">
        {rooms.map((room) => {
          const { view, actionId } = slotAt(week, room)
          const content = (
            <>
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1 font-semibold">
                {room}
                {partTerm.has(room) && (
                  <span className="rounded-full bg-surface/70 px-2 py-0.5 text-xs font-medium">{NOT_EVERY_WEEK}</span>
                )}
              </span>
              <span className="mt-1 flex gap-2 text-sm">
                <StatusDot view={view} />
                <span className="min-w-0 [overflow-wrap:anywhere]">
                  {cellText(view)}
                  <PastNote view={view} />
                </span>
              </span>
            </>
          )

          return (
            <li key={room}>
              {actionId ? (
                <button
                  type="button"
                  className={`flex w-full items-center justify-between gap-4 rounded-2xl p-4 text-left transition active:scale-[0.99] ${cellClasses(view)}`}
                  onClick={() => onSelect(actionId)}
                >
                  <span className="min-w-0">{content}</span>
                  <span aria-hidden="true" className="shrink-0 rounded-full bg-surface px-3.5 py-1.5 text-sm font-medium text-ink shadow-sm">
                    {view.kind === CellKind.Open ? 'Claim' : 'Manage'}
                  </span>
                </button>
              ) : (
                <div className={`rounded-2xl p-4 ${cellClasses(view)}`}>{content}</div>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function DayGrid({ data, day, dates, week, myId, role, today, onWeekChange, onSelect }: DayPartProps) {
  const { rooms, partTerm, slotAt } = useDayLookups(data, day, myId, role, today)

  return (
    // Scrolls with the page (not inside the card), so the room names can stick just below the site header.
    <div className={`${cardClass} p-3 sm:p-4`}>
      <table className="w-full table-fixed border-separate border-spacing-1.5 text-sm">
        <caption className="sr-only">{DAY_LABELS[day]} rooms, by week</caption>
        <thead>
          <tr>
            <th scope="col" className={`${eyebrowClass} ${stickyHeadClass} w-28 px-2 pb-3 text-left align-bottom`}>
              Week
            </th>
            {rooms.map((room) => (
              <th key={room} scope="col" className={`${stickyHeadClass} px-2.5 pb-3 text-left align-bottom font-semibold`}>
                {room}
                {partTerm.has(room) && <span className="block text-xs font-normal text-muted">{NOT_EVERY_WEEK}</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dates.map((date) => {
            const selected = date === week

            return (
              <tr key={date} aria-current={selected ? 'date' : undefined}>
                <th scope="row" className="whitespace-nowrap pr-2 text-left align-top">
                  <button
                    type="button"
                    className={`mt-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition ${
                      selected ? 'bg-primary text-on-primary' : 'text-muted hover:bg-sunk hover:text-ink'
                    }`}
                    onClick={() => onWeekChange(date)}
                    aria-label={formatLongDate(date)}
                  >
                    {formatShortDate(date)}
                  </button>
                </th>
                {rooms.map((room) => {
                  const { view, actionId } = slotAt(date, room)
                  const content = (
                    <span className="flex gap-2">
                      <StatusDot view={view} />
                      <span className="min-w-0 [overflow-wrap:anywhere]">{cellText(view)}</span>
                    </span>
                  )

                  // Tappable tiles: the button's click area is stretched over the whole cell (after:inset-0),
                  // and the cell shows the button's keyboard focus ring.
                  const tappable =
                    'transition hover:brightness-[0.97] dark:hover:brightness-110 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus'

                  return (
                    <td key={room} className={`${tileClass} ${cellClasses(view)} ${actionId ? tappable : ''}`}>
                      {actionId ? (
                        <button
                          type="button"
                          className="block w-full text-left outline-none after:absolute after:inset-0 after:rounded-xl"
                          onClick={() => onSelect(actionId)}
                          aria-label={`${cellText(view)}. ${actionLabel(view)}: ${room}, ${formatLongDate(date)}`}
                        >
                          {content}
                        </button>
                      ) : (
                        <>
                          {content}
                          <PastNote view={view} />
                        </>
                      )}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
