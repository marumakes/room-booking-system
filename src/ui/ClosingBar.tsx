import { useId, useState, type FormEvent } from 'react'
import { isClosed } from '../domain/claims'
import { fromSiteClock, toSiteClock } from '../domain/dates'
import { ViewerRole } from '../domain/profile'
import type { RoomsData } from '../domain/rooms'
import { ExportButton } from './ExportButton'
import { CLAIM_FAILURE_MESSAGES, CLOSED_HELP_TEXT, closingText } from './messages'
import { NoticeKind, type Notice } from './notice'
import { useRepos } from './repos'
import { ErrorText, cardClass, eyebrowClass, inputClass, linkButtonClass, pillButtonClass, primaryButtonClass, secondaryButtonClass } from './Screen'
import { Sheet } from './Sheet'

type ClosingBarProps = {
  data: RoomsData
  role: ViewerRole
  onDone: (notice: Notice) => void
}

// The closing time, for everyone once it's set. Committee also get "Change closing time" and the export.
export function ClosingBar({ data, role, onDone }: ClosingBarProps) {
  const [editing, setEditing] = useState(false)
  const committee = role === ViewerRole.Committee

  if (!data.closesAt && !committee) {
    return null
  }

  const closed = isClosed(data.closesAt)
  const status = data.closesAt ? closingText(data.closesAt, closed) : 'No closing time set.'

  function onSaved(notice: Notice) {
    setEditing(false)
    onDone(notice)
  }

  return (
    <div className={`${cardClass} flex flex-wrap items-center justify-between gap-4`}>
      <div className="flex gap-3">
        <span aria-hidden="true" className={`mt-1.5 size-2.5 shrink-0 rounded-full ${closed ? 'bg-taken-dot' : 'bg-open-dot'}`} />
        <div>
          <p className={eyebrowClass}>{closed ? 'Sign-up closed' : 'Sign-up open'}</p>
          <p className="mt-0.5 font-medium">
            {status}
            {closed && !committee && ` ${CLOSED_HELP_TEXT}`}
          </p>
        </div>
      </div>

      {committee && (
        <div className="flex flex-wrap items-start gap-2">
          <button type="button" className={pillButtonClass} onClick={() => setEditing(true)}>
            {data.closesAt ? 'Change closing time' : 'Set closing time'}
          </button>
          <ExportButton data={data} onDone={onDone} />
        </div>
      )}

      {editing && (
        <Sheet title="Closing time" subtitle="When hosts can no longer claim or release rooms" onClose={() => setEditing(false)}>
          <ClosingTimeForm closesAt={data.closesAt} onCancel={() => setEditing(false)} onDone={onSaved} />
        </Sheet>
      )}
    </div>
  )
}

type ClosingTimeFormProps = {
  closesAt: string | null
  onCancel: () => void
  onDone: (notice: Notice) => void
}

// Committee only: set, change or remove the closing time. Entered in London time.
function ClosingTimeForm({ closesAt, onCancel, onDone }: ClosingTimeFormProps) {
  const { claims } = useRepos()
  const inputId = useId()
  const hintId = useId()
  const [value, setValue] = useState(closesAt ? toSiteClock(closesAt) : '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save(next: string | null, done: string) {
    setBusy(true)
    setError(null)
    const result = await claims.setClosingTime(next)
    setBusy(false)

    if (!result.ok) {
      setError(CLAIM_FAILURE_MESSAGES[result.failure])
      return
    }

    onDone({ kind: NoticeKind.Success, text: done })
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault()

    if (!value) {
      setError('Choose a date and time.')
      return
    }

    const next = fromSiteClock(value)
    void save(next, closingText(next, isClosed(next)))
  }

  return (
    <form onSubmit={onSubmit}>
      <label htmlFor={inputId} className="mb-2 block font-medium">
        Closing time (London time)
      </label>
      <input
        id={inputId}
        type="datetime-local"
        className={inputClass}
        value={value}
        aria-describedby={hintId}
        onChange={(e) => setValue(e.target.value)}
      />
      <p id={hintId} className="mt-2 text-sm text-muted">
        After this, hosts can’t claim or release rooms. Committee can still clear claims. A time that has already passed
        closes sign-up straight away.
      </p>
      <ErrorText message={error} />
      <button type="submit" className={primaryButtonClass} disabled={busy}>
        Save closing time
      </button>
      {closesAt && (
        <button
          type="button"
          className={secondaryButtonClass}
          disabled={busy}
          onClick={() => void save(null, 'Closing time removed. Sign-up is open.')}
        >
          Remove closing time
        </button>
      )}
      <button type="button" className={`${linkButtonClass} mt-4`} onClick={onCancel}>
        Cancel
      </button>
    </form>
  )
}
