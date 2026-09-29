import type { PostgrestError } from '@supabase/supabase-js'
import { ClaimFailure } from '../domain/claims'
import { toDataFailure } from './postgrestErrors'

// Postgres "raise exception" without an explicit code; the claim functions put a reason code in the message.
const PG_RAISE_EXCEPTION = 'P0001'

const REASON_CODES = new Set<string>(Object.values(ClaimFailure))

function isClaimFailure(value: string): value is ClaimFailure {
  return REASON_CODES.has(value)
}

// Maps a database reason code (e.g. "room_full") to a domain failure; anything else is a data failure.
export function toClaimFailure(error: PostgrestError): ClaimFailure {
  if (error.code === PG_RAISE_EXCEPTION && isClaimFailure(error.message)) {
    return error.message
  }

  return toDataFailure(error)
}
