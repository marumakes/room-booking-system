import type { PostgrestError } from '@supabase/supabase-js'
import { DataFailure } from '../domain/failure'

// PostgREST reports network failures with an empty code. Anything unexpected is logged
// to the browser console so it can be diagnosed; the UI only shows a friendly message.
export function toDataFailure(error: PostgrestError): DataFailure {
  console.error('Supabase data error', error)
  return error.code ? DataFailure.Unknown : DataFailure.Network
}
