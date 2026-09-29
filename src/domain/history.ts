// Claim history, for committee: who claimed, released or cleared what, and when.
import type { DataFailure } from './failure'
import type { ClaimMode } from './rooms'

export const ClaimAction = {
  Claimed: 'claimed',
  Released: 'released',
  Cleared: 'cleared',
  Removed: 'removed',
} as const
export type ClaimAction = (typeof ClaimAction)[keyof typeof ClaimAction]

export type HistoryEntry = {
  id: number
  occurredAt: string
  action: ClaimAction
  sessionDate: string
  room: string
  mode: ClaimMode
  ownerName: string
  // Who did it; null when the claim went because the user was deleted.
  actorName: string | null
}

export type HistoryResult = { ok: true; entries: HistoryEntry[] } | { ok: false; failure: DataFailure }

export interface HistoryRepo {
  // Newest first. Only committee members get any entries.
  loadHistory(): Promise<HistoryResult>
}
