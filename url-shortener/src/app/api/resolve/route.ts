import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

export async function POST(request: NextRequest) {
  try {
    const { shortCode } = await request.json()

    if (!shortCode) {
      return NextResponse.json({ error: 'Short code is required' }, { status: 400 })
    }

    // Fetch the original URL from Supabase
    const { data, error } = await supabase
      .from('urls')
      .select('original_url')
      .eq('short_code', shortCode)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'Short URL not found' }, { status: 404 })
    }

    return NextResponse.json({ originalUrl: data.original_url })
  } catch (error) {
    console.error('Error resolving short URL:', error)
    return NextResponse.json({ error: 'Failed to resolve URL' }, { status: 500 })
  }
}
