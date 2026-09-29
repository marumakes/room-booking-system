import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

// The one Supabase client. Only the data layer imports this.
// Keys come from .env.development.local (local stack) or .env.production.local / host env (hosted).
const url = import.meta.env.VITE_SUPABASE_URL
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!url || !publishableKey) {
  throw new Error('VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY must be set')
}

export const supabase = createClient<Database>(url, publishableKey)
