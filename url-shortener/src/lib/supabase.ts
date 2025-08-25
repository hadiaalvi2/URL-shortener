import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_ANON_KEY!

console.log('Supabase Config:', {
  hasUrl: !!supabaseUrl,
  hasKey: !!supabaseKey,
  urlLength: supabaseUrl?.length,
  keyLength: supabaseKey?.length
})

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables. Please check your Vercel environment variables.')
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
})