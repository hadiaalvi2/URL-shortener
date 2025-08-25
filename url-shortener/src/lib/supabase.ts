import { createClient } from '@supabase/supabase-js'

// Debug logging
console.log('Supabase Environment Check:', {
  hasSupabaseUrl: !!process.env.SUPABASE_URL,
  hasSupabaseKey: !!process.env.SUPABASE_ANON_KEY,
  nodeEnv: process.env.NODE_ENV
})

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Missing Supabase environment variables. ' +
    'SUPABASE_URL: ' + (supabaseUrl ? 'set' : 'missing') + ', ' +
    'SUPABASE_ANON_KEY: ' + (supabaseKey ? 'set' : 'missing')
  )
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
})