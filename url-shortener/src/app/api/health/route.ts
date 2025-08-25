import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  try {
    // Test database connection
    const { data, error } = await supabase
      .from('urls')
      .select('count')
      .limit(1)

    return NextResponse.json({
      status: 'ok',
      database: error ? 'error' : 'connected',
      error: error?.message,
      timestamp: new Date().toISOString()
    })
  } catch (error: any) {
    return NextResponse.json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}