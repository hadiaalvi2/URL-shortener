import { NextRequest, NextResponse } from "next/server"
import { refreshMetadata, getUrl } from "@/lib/url-store"

export async function POST(request: NextRequest) {
  try {
    const { shortCode } = await request.json()

    if (!shortCode) {
      return NextResponse.json({ error: 'Short code is required' }, { status: 400 })
    }

    // Check if short code exists
    const existingData = await getUrl(shortCode)
    if (!existingData) {
      return NextResponse.json({ error: 'Short URL not found' }, { status: 404 })
    }

    // Refresh metadata
    console.log(`Manual refresh requested for ${shortCode}`)
    const refreshedData = await refreshMetadata(shortCode)
    
    if (!refreshedData) {
      return NextResponse.json({ error: 'Failed to refresh metadata' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      metadata: refreshedData,
      message: 'Metadata refreshed successfully'
    })

  } catch (error) {
    console.error('Error refreshing metadata:', error)
    return NextResponse.json(
      { error: 'Failed to refresh metadata', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
