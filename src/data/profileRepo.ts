import type { PostgrestError } from '@supabase/supabase-js'
import { ProfileFailure, ViewerRole, type ProfileRepo, type ProfileResult } from '../domain/profile'
import { toDataFailure } from './postgrestErrors'
import { supabase } from './supabaseClient'

// Postgres unique violation, raised by either the primary key or the display-name index.
const PG_UNIQUE_VIOLATION = '23505'

// Index from the names migration; its name appears in the error when a display name clashes.
const DISPLAY_NAME_INDEX = 'profiles_display_name_unique'

function isNameClash(error: PostgrestError): boolean {
  return error.code === PG_UNIQUE_VIOLATION && error.message.includes(DISPLAY_NAME_INDEX)
}

function toProfileFailure(error: PostgrestError): ProfileResult {
  const failure = isNameClash(error) ? ProfileFailure.NameTaken : toDataFailure(error)
  return { ok: false, failure }
}

// Display names in the profiles table.
export const supabaseProfileRepo: ProfileRepo = {
  async getProfile(userId) {
    const { data, error } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('user_id', userId)
      .maybeSingle()

    if (error) {
      return toProfileFailure(error)
    }

    const profile = data ? { userId, displayName: data.display_name } : null
    return { ok: true, profile }
  },

  async createProfile(userId, displayName) {
    const { error } = await supabase
      .from('profiles')
      .insert({ user_id: userId, display_name: displayName })

    // A primary-key clash means the profile already exists (e.g. a double-submitted form).
    if (error && (error.code !== PG_UNIQUE_VIOLATION || isNameClash(error))) {
      return toProfileFailure(error)
    }

    // Re-read so a duplicate submit returns the name that was actually stored.
    return supabaseProfileRepo.getProfile(userId)
  },

  async renameProfile(userId, displayName) {
    const { error } = await supabase
      .from('profiles')
      .update({ display_name: displayName })
      .eq('user_id', userId)

    if (error) {
      return toProfileFailure(error)
    }

    return supabaseProfileRepo.getProfile(userId)
  },

  async getRole() {
    const { data, error } = await supabase.rpc('is_committee')

    if (error) {
      toDataFailure(error)
      return ViewerRole.Host
    }

    return data ? ViewerRole.Committee : ViewerRole.Host
  },
}
