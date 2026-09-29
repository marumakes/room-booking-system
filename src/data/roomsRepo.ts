import type { Claim, RoomsRepo, Session } from '../domain/rooms'
import { toDataFailure } from './postgrestErrors'
import { supabase } from './supabaseClient'

// Tables whose changes affect what the grid shows.
const WATCHED_TABLES = ['signups', 'profiles', 'settings'] as const
const CHANNEL_NAME = 'rooms'

// Sessions and claims from Supabase, mapped to domain shapes.
export const supabaseRoomsRepo: RoomsRepo = {
  async loadRooms() {
    const [sessionsQuery, claimsQuery, settingsQuery] = await Promise.all([
      supabase.from('sessions').select('id, session_date, day_type, room, room_position, available'),
      supabase.from('signups').select('id, session_id, slot_number, mode, owner_id, profiles(display_name)'),
      supabase.from('settings').select('claims_close_at').maybeSingle(),
    ])
    if (sessionsQuery.error) {
      return { ok: false, failure: toDataFailure(sessionsQuery.error) }
    }

    if (claimsQuery.error) {
      return { ok: false, failure: toDataFailure(claimsQuery.error) }
    }

    if (settingsQuery.error) {
      return { ok: false, failure: toDataFailure(settingsQuery.error) }
    }

    const sessions: Session[] = sessionsQuery.data.map((s) => ({
      id: s.id,
      date: s.session_date,
      day: s.day_type,
      room: s.room,
      roomPosition: s.room_position,
      available: s.available,
    }))

    const claims: Claim[] = claimsQuery.data.map((c) => ({
      id: c.id,
      sessionId: c.session_id,
      slot: c.slot_number,
      mode: c.mode,
      ownerId: c.owner_id,
      ownerName: c.profiles?.display_name ?? '',
    }))

    const closesAt = settingsQuery.data?.claims_close_at ?? null
    return { ok: true, data: { sessions, claims, closesAt } }
  },

  // Supabase Realtime: one channel listening for any insert, update or delete on the watched tables.
  // The first SUBSCRIBED is the initial connect; later ones are reconnects, which may have missed changes.
  onChange(callback) {
    let connectedBefore = false
    const channel = supabase.channel(CHANNEL_NAME)

    for (const table of WATCHED_TABLES) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => callback())
    }

    channel.subscribe((status) => {
      if (status !== 'SUBSCRIBED') {
        return
      }

      if (connectedBefore) {
        callback()
      }

      connectedBefore = true
    })

    return () => {
      void supabase.removeChannel(channel)
    }
  },
}
