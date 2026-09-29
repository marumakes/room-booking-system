import type { HistoryRepo } from '../domain/history'
import { toDataFailure } from './postgrestErrors'
import { supabase } from './supabaseClient'

// Claim history from Supabase. Access rules return nothing to non-committee users.
export const supabaseHistoryRepo: HistoryRepo = {
  async loadHistory() {
    const { data, error } = await supabase
      .from('claim_history')
      .select('id, occurred_at, action, session_date, room, mode, owner_name, actor_name')
      .order('id', { ascending: false })

    if (error) {
      return { ok: false, failure: toDataFailure(error) }
    }

    const entries = data.map((e) => ({
      id: e.id,
      occurredAt: e.occurred_at,
      action: e.action,
      sessionDate: e.session_date,
      room: e.room,
      mode: e.mode,
      ownerName: e.owner_name,
      actorName: e.actor_name,
    }))

    return { ok: true, entries }
  },
}
