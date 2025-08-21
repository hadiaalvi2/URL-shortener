import { NextRequest, NextResponse } from "next/server"
import { createShortCode } from "@/lib/url-store"

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json()

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 })
    }

    let normalizedUrl: string;
    try {
      let urlToParse = url;
      if (!urlToParse.startsWith('http://') && !urlToParse.startsWith('https://')) {
        urlToParse = 'https://' + urlToParse;
      }
      
      const parsed = new URL(urlToParse);
      normalizedUrl = parsed.toString();
      
      if (normalizedUrl.endsWith('/')) {
        normalizedUrl = normalizedUrl.slice(0, -1);
      }
    } catch {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
    }

    // Fetch metadata from the dedicated metadata API
    const metaResponse = await fetch(`${request.nextUrl.origin}/api/metadata`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: normalizedUrl })
    })
    
    if (!metaResponse.ok) {
      throw new Error('Failed to fetch metadata');
    }
    
    const metadata = await metaResponse.json()

    const shortCode = await createShortCode(normalizedUrl, metadata)
    
    return NextResponse.json({ 
      shortCode,
      metadata
    })
  } catch (error) {
    console.error('Error shortening URL:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}