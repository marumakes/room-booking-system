import type { ClaimsRepo } from '../domain/claims'
import { toClaimFailure } from './claimErrors'
import { supabase } from './supabaseClient'

// Claims and releases through the database functions; the table can't be written directly.
export const supabaseClaimsRepo: ClaimsRepo = {
  async claimSlot(sessionId, mode) {
    const { error } = await supabase.rpc('claim_slot', { p_session_id: sessionId, p_mode: mode })
    return error ? { ok: false, failure: toClaimFailure(error) } : { ok: true }
  },

  async claimSeries(room, day, mode) {
    const { data, error } = await supabase.rpc('claim_series', { p_room: room, p_day: day, p_mode: mode })

    if (error) {
      return { ok: false, failure: toClaimFailure(error) }
    }

    // A non-empty list means some weeks were taken and nothing was claimed.
    return data.length > 0 ? { ok: false, conflicts: data } : { ok: true }
  },

  async releaseClaim(sessionId) {
    const { data, error } = await supabase.rpc('release_claim', { p_session_id: sessionId })
    return error ? { ok: false, failure: toClaimFailure(error) } : { ok: true, released: data }
  },

  async releaseSeries(room, day) {
    const { data, error } = await supabase.rpc('release_series', { p_room: room, p_day: day })
    return error ? { ok: false, failure: toClaimFailure(error) } : { ok: true, released: data }
  },

  async clearClaim(sessionId, ownerId) {
    const { data, error } = await supabase.rpc('clear_claim', { p_session_id: sessionId, p_owner_id: ownerId })
    return error ? { ok: false, failure: toClaimFailure(error) } : { ok: true, released: data }
  },

  // The generated type doesn't allow null, but the function takes it to remove the closing time.
  async setClosingTime(closesAt) {
    const { error } = await supabase.rpc('set_closing_time', { p_close_at: closesAt as string })
    return error ? { ok: false, failure: toClaimFailure(error) } : { ok: true }
  },
}
