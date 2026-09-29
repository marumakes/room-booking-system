import { useEffect, useState } from 'react'
import { formatDateTime, formatShortDate } from '../domain/dates'
import type { HistoryEntry } from '../domain/history'
import { DATA_FAILURE_MESSAGES, historyText } from './messages'
import { useRepos } from './repos'
import { cardClass, pillButtonClass } from './Screen'

const LoadStatus = {
  Loading: 'loading',
  Failed: 'failed',
  Ready: 'ready',
} as const

type HistoryView =
  | { status: typeof LoadStatus.Loading }
  | { status: typeof LoadStatus.Failed; message: string }
  | { status: typeof LoadStatus.Ready; entries: HistoryEntry[] }

// Committee only: every claim, release and clear, newest first, for settling disputes.
export function HistoryPage() {
  const { history } = useRepos()
  const [view, setView] = useState<HistoryView>({ status: LoadStatus.Loading })
  const [reloadCount, setReloadCount] = useState(0)

  useEffect(() => {
    let current = true

    void history.loadHistory().then((result) => {
      if (!current) {
        return
      }

      setView(
        result.ok
          ? { status: LoadStatus.Ready, entries: result.entries }
          : { status: LoadStatus.Failed, message: DATA_FAILURE_MESSAGES[result.failure] },
      )
    })

    return () => {
      current = false
    }
  }, [history, reloadCount])

  return (
    <section aria-labelledby="history-heading" className={cardClass}>
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h2 id="history-heading" className="text-xl font-semibold tracking-tight">
            Claim history
          </h2>
          <p className="text-sm text-muted">Every claim, release and clear, newest first.</p>
        </div>
        <button type="button" className={pillButtonClass} onClick={() => setReloadCount((n) => n + 1)}>
          Refresh
        </button>
      </div>

      {view.status === LoadStatus.Loading && <p>Loading history…</p>}
      {view.status === LoadStatus.Failed && <p role="alert">{view.message}</p>}
      {view.status === LoadStatus.Ready && view.entries.length === 0 && <p>Nothing has been claimed yet.</p>}

      {/* Phones: one card per entry. Wider screens: a table. */}
      {view.status === LoadStatus.Ready && view.entries.length > 0 && (
        <ol className="divide-y divide-line md:hidden" aria-label="Claim history, newest first">
          {view.entries.map((e) => (
            <li key={e.id} className="py-3">
              <p className="font-medium">{historyText(e)}</p>
              <p className="text-sm">
                {e.room} · {formatShortDate(e.sessionDate)}
              </p>
              <p className="text-sm text-muted">{formatDateTime(e.occurredAt)}</p>
            </li>
          ))}
        </ol>
      )}

      {view.status === LoadStatus.Ready && view.entries.length > 0 && (
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Claim history, newest first</caption>
            <thead className="text-xs uppercase tracking-wider text-muted">
              <tr>
                <th scope="col" className="px-3 pb-3 font-medium">When</th>
                <th scope="col" className="px-3 pb-3 font-medium">What happened</th>
                <th scope="col" className="px-3 pb-3 font-medium">Room</th>
                <th scope="col" className="px-3 pb-3 font-medium">Session</th>
              </tr>
            </thead>
            <tbody>
              {view.entries.map((e) => (
                <tr key={e.id} className="border-t border-line">
                  <td className="whitespace-nowrap px-3 py-3">{formatDateTime(e.occurredAt)}</td>
                  <td className="px-3 py-3 font-medium">{historyText(e)}</td>
                  <td className="whitespace-nowrap px-3 py-3">{e.room}</td>
                  <td className="whitespace-nowrap px-3 py-3">{formatShortDate(e.sessionDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
