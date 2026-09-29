import { PostgrestError } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import { ClaimFailure } from '../domain/claims'
import { toClaimFailure } from './claimErrors'

function pgError(code: string, message: string) {
  return new PostgrestError({ code, message, details: '', hint: '' })
}

describe('toClaimFailure', () => {
  it('maps the database’s reason codes', () => {
    expect(toClaimFailure(pgError('P0001', 'room_full'))).toBe(ClaimFailure.RoomFull)
    expect(toClaimFailure(pgError('P0001', 'room_not_every_week'))).toBe(ClaimFailure.NotEveryWeek)
    expect(toClaimFailure(pgError('P0001', 'session_past'))).toBe(ClaimFailure.SessionPast)
  })

  it('treats anything else as a data failure, and logs it', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(toClaimFailure(pgError('P0001', 'something new'))).toBe(ClaimFailure.Unknown)
    expect(toClaimFailure(pgError('42501', 'permission denied'))).toBe(ClaimFailure.Unknown)
    expect(toClaimFailure(pgError('', 'Failed to fetch'))).toBe(ClaimFailure.Network)
    expect(log).toHaveBeenCalledTimes(3)

    log.mockRestore()
  })
})
