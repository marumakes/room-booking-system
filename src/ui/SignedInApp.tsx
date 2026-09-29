import { useEffect, useState } from 'react'
import { onPageVisible } from '../data/pageVisibility'
import { Navigate, Route, Routes } from 'react-router'
import { CALENDAR_FILE_NAME, CALENDAR_MIME_TYPE, buildCalendar } from '../domain/calendar'
import { siteToday } from '../domain/dates'
import { ViewerRole, type Profile } from '../domain/profile'
import { defaultDay, mySessions, sessionDays, type RoomsData } from '../domain/rooms'
import { ClosingBar } from './ClosingBar'
import { DayTabs } from './DayTabs'
import { DayView } from './DayView'
import { Header } from './Header'
import { HistoryPage } from './HistoryPage'
import { DATA_FAILURE_MESSAGES } from './messages'
import type { Notice } from './notice'
import { NoticeBar } from './NoticeBar'
import { RoomsSkeleton } from './RoomsSkeleton'
import { useRepos } from './repos'
import { Visit } from './visit'
import { WelcomeSheet } from './WelcomeSheet'
import { HelpFooter, primaryButtonClass } from './Screen'
import { SessionSheet } from './SessionSheet'
import { YourSessions } from './YourSessions'

// How long to wait for more changes before reloading, so a burst causes one reload.
const LIVE_RELOAD_DELAY_MS = 250

const LoadStatus = {
  Loading: 'loading',
  Failed: 'failed',
  Ready: 'ready',
} as const

type RoomsView =
  | { status: typeof LoadStatus.Loading }
  | { status: typeof LoadStatus.Failed; message: string }
  | { status: typeof LoadStatus.Ready; data: RoomsData }

type SignedInAppProps = {
  profile: Profile
  onProfileChange: (profile: Profile) => void
  // First visit shows the welcome straight away.
  visit?: Visit
}

// Everything after sign-in: header, day tabs, the host's sessions and the room views.
export function SignedInApp({ profile, onProfileChange, visit = Visit.Returning }: SignedInAppProps) {
  const { rooms, profiles } = useRepos()
  const [view, setView] = useState<RoomsView>({ status: LoadStatus.Loading })
  const [role, setRole] = useState<ViewerRole | null>(null)
  const [reloadCount, setReloadCount] = useState(0)
  // The "how it works" sheet: open straight away on a first visit, and from the account menu.
  const [guide, setGuide] = useState<Visit | null>(visit === Visit.First ? Visit.First : null)

  // Loads all sessions and claims. Reloads after a claim, release or rename; keeps showing the
  // current data meanwhile so the page doesn't flash.
  useEffect(() => {
    let current = true

    void rooms.loadRooms().then((result) => {
      if (!current) {
        return
      }

      setView(result.ok ? { status: LoadStatus.Ready, data: result.data } : { status: LoadStatus.Failed, message: DATA_FAILURE_MESSAGES[result.failure] })
    })

    return () => {
      current = false
    }
  }, [rooms, reloadCount, profile.displayName])

  // Committee status, checked once per sign-in. Unknown (null) until loaded.
  useEffect(() => {
    let current = true

    void profiles.getRole().then((loaded) => {
      if (current) {
        setRole(loaded)
      }
    })

    return () => {
      current = false
    }
  }, [profiles, profile.userId])

  // Live updates: reload when claims or names change elsewhere, or when the page comes back into view.
  // Bursts (a multi-book is up to 11 changes) are batched into one reload.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined

    const reloadSoon = () => {
      clearTimeout(timer)
      timer = setTimeout(() => setReloadCount((n) => n + 1), LIVE_RELOAD_DELAY_MS)
    }

    const stopLive = rooms.onChange(reloadSoon)
    const stopVisible = onPageVisible(reloadSoon)

    return () => {
      clearTimeout(timer)
      stopLive()
      stopVisible()
    }
  }, [rooms])

  function retry() {
    setView({ status: LoadStatus.Loading })
    setReloadCount((n) => n + 1)
  }

  return (
    <>
      <Header
        profile={profile}
        role={role ?? ViewerRole.Host}
        onProfileChange={onProfileChange}
        onHowItWorks={() => setGuide(Visit.Returning)}
      />
      {guide && <WelcomeSheet name={profile.displayName} visit={guide} onClose={() => setGuide(null)} />}
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
        {view.status === LoadStatus.Loading && <RoomsSkeleton />}

        {view.status === LoadStatus.Failed && (
          <div>
            <p role="alert">{view.message}</p>
            <button type="button" className={`${primaryButtonClass} max-w-xs`} onClick={retry}>
              Try again
            </button>
          </div>
        )}

        {view.status === LoadStatus.Ready && (
          <RoomsScreen data={view.data} myId={profile.userId} role={role} reload={() => setReloadCount((n) => n + 1)} />
        )}
      </main>
      <HelpFooter />
    </>
  )
}

type RoomsScreenProps = {
  data: RoomsData
  myId: string
  // null while still being checked.
  role: ViewerRole | null
  reload: () => void
}

type HistoryRouteProps = {
  role: ViewerRole | null
  home: string
}

// /history is for committee; anyone else is sent back to the rooms.
function HistoryRoute({ role, home }: HistoryRouteProps) {
  if (role === null) {
    return <p>Loading…</p>
  }

  return role === ViewerRole.Committee ? <HistoryPage /> : <Navigate to={home} replace />
}

// The rooms, plus the sheet for a tapped room and the result of the last claim or release.
// Routes: /monday and /thursday (with optional ?week=); anything else goes to the day with the next session.
function RoomsScreen({ data, myId, role, reload }: RoomsScreenProps) {
  const viewerRole = role ?? ViewerRole.Host
  const { files } = useRepos()
  const [selected, setSelected] = useState<string | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)
  const today = siteToday()
  const home = `/${defaultDay(data.sessions, today)}`
  const mine = mySessions(data, myId)

  // After any claim or release: show the outcome and reload, so the grid is current either way.
  function onDone(result: Notice) {
    setSelected(null)
    setNotice(result)
    reload()
  }

  // Downloads a calendar file with the host's upcoming sessions.
  function saveCalendar() {
    const upcoming = mine.filter((s) => s.date >= today)
    files.save(CALENDAR_FILE_NAME, buildCalendar(upcoming), CALENDAR_MIME_TYPE)
  }

  return (
    <>
      {notice && <NoticeBar notice={notice} onCalendar={saveCalendar} onDismiss={() => setNotice(null)} />}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Rooms</h1>
          <p className="mt-1 text-muted">Tap a room to claim it, or to manage your claim.</p>
        </div>
        <DayTabs days={sessionDays(data.sessions)} />
      </div>
      <ClosingBar data={data} role={viewerRole} onDone={onDone} />
      <YourSessions sessions={mine} today={today} onRelease={setSelected} onCalendar={saveCalendar} />
      <Routes>
        <Route path="/history" element={<HistoryRoute role={role} home={home} />} />
        <Route path="/:day" element={<DayView data={data} myId={myId} role={viewerRole} today={today} onSelect={setSelected} />} />
        <Route path="*" element={<Navigate to={home} replace />} />
      </Routes>
      {selected && (
        <SessionSheet
          key={selected}
          data={data}
          sessionId={selected}
          myId={myId}
          role={viewerRole}
          today={today}
          onSelect={setSelected}
          onClose={() => setSelected(null)}
          onDone={onDone}
        />
      )}
    </>
  )
}
