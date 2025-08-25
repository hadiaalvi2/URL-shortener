import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  return NextResponse.json({
    supabaseUrl: process.env.SUPABASE_URL ? 'Set' : 'Not set',
    supabaseKey: process.env.SUPABASE_ANON_KEY ? 'Set' : 'Not set',
    baseUrl: process.env.NEXT_PUBLIC_BASE_URL,
    vercelEnv: process.env.VERCEL_ENV
  })
}