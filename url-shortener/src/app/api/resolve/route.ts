import { NextRequest, NextResponse } from "next/server"
import { getOriginalUrl } from "@/lib/url-store"

export async function POST(request: NextRequest) {
  try {
    const { shortCode } = await request.json()

    if (!shortCode) {
      return NextResponse.json({ error: 'Short code is required' }, { status: 400 })
    }

    const originalUrl = await getOriginalUrl(shortCode)
    
    if (!originalUrl) {
      return NextResponse.json({ error: 'Short URL not found' }, { status: 404 })
    }

    return NextResponse.json({ originalUrl })
  } catch (error) {
    console.error('Error resolving short URL:', error)
    return NextResponse.json({ error: 'Failed to resolve URL' }, { status: 500 })
  }
}