import { useState } from 'react'
import { otherClaimants, type OtherClaimant } from '../domain/claims'
import { formatShortDate } from '../domain/dates'
import { ClaimMode, type RoomsData, type Session } from '../domain/rooms'
import { CLAIM_FAILURE_MESSAGES } from './messages'
import { NoticeKind, type Notice } from './notice'
import { useRepos } from './repos'
import { ErrorText, dangerButtonClass, eyebrowClass, linkButtonClass } from './Screen'

// White pill on the grey row.
const clearButtonClass = 'rounded-full bg-surface px-3.5 py-1.5 text-sm font-medium shadow-sm transition hover:bg-track'

type CommitteeClearProps = {
  data: RoomsData
  session: Session
  myId: string
  onDone: (notice: Notice) => void
}

// Committee only: remove another host's claim on this night, with a confirmation step.
export function CommitteeClear({ data, session, myId, onDone }: CommitteeClearProps) {
  const { claims } = useRepos()
  const [confirming, setConfirming] = useState<OtherClaimant | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const claimants = otherClaimants(data, session.id, myId)

  if (claimants.length === 0) {
    return null
  }

  async function clear(claimant: OtherClaimant) {
    setBusy(true)
    setError(null)
    const result = await claims.clearClaim(session.id, claimant.ownerId)
    setBusy(false)

    if (!result.ok) {
      setError(CLAIM_FAILURE_MESSAGES[result.failure])
      return
    }

    onDone({
      kind: NoticeKind.Success,
      text: `Cleared ${claimant.ownerName}’s claim on ${session.room}, ${formatShortDate(session.date)}.`,
    })
  }

  return (
    <section aria-labelledby="committee-heading" className="mt-8 border-t border-line pt-6">
      <h3 id="committee-heading" className={eyebrowClass}>
        Committee
      </h3>
      <ul className="mt-3 space-y-2">
        {claimants.map((c) => (
          <li key={c.ownerId} className="rounded-2xl bg-sunk p-4">
            {confirming?.ownerId === c.ownerId ? (
              <div>
                <p className="text-sm">
                  Clear {c.ownerName}’s claim? They’ll lose this room on {formatShortDate(session.date)}, and anyone can then
                  claim it.
                </p>
                <div className="mt-3 flex items-center gap-4">
                  <button type="button" className={dangerButtonClass} disabled={busy} onClick={() => void clear(c)}>
                    Yes, clear it
                  </button>
                  <button type="button" className={linkButtonClass} disabled={busy} onClick={() => setConfirming(null)}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <span>
                  {c.ownerName}
                  {c.mode === ClaimMode.Quiet && <span className="text-sm text-muted"> (quiet room)</span>}
                </span>
                <button
                  type="button"
                  className={clearButtonClass}
                  onClick={() => setConfirming(c)}
                  aria-label={`Clear ${c.ownerName}’s claim`}
                >
                  Clear
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
      <ErrorText message={error} />
    </section>
  )
}
