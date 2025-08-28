import { NextRequest, NextResponse } from "next/server"
import { createShortCode, getUrl, getAllUrls } from "@/lib/url-store"
import { kv } from "@vercel/kv";
import { fetchPageMetadata } from "@/lib/utils";
import { isWeakMetadata, updateUrlData } from "@/lib/url-store";

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL!;

export async function POST(request: NextRequest) {
  try {
    const { url, force } = await request.json()

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 })
    }

    let normalizedUrl: string;
    try {
      let urlToParse = url.trim();
      if (!urlToParse.startsWith('http://') && !urlToParse.startsWith('https://')) {
        urlToParse = 'https://' + urlToParse;
      }
      
      const parsed = new URL(urlToParse);
      normalizedUrl = parsed.toString();

      if (normalizedUrl.endsWith('/')) {
        normalizedUrl = normalizedUrl.slice(0, -1);
      }
    } catch (error) {
      console.error('URL validation error:', error);
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 })
    }

    // Check if it's a YouTube URL for enhanced handling
    const isYouTube = normalizedUrl.includes('youtube.com') || normalizedUrl.includes('youtu.be');

    try {
      const existingShortCode = await kv.get<string>(`url_to_code:${normalizedUrl}`)
      
      if (existingShortCode) {
        const existingData = await getUrl(existingShortCode);
        
        // For YouTube URLs or if user forces refresh, try to re-scrape and update
        if (force || isYouTube || isWeakMetadata(existingData)) {
          try {
            console.log(`[shorten] Refreshing metadata for existing URL: ${normalizedUrl}`);
            const fresh = await fetchPageMetadata(normalizedUrl);
            
            // Only update if we got better metadata
            if (fresh.title || fresh.description) {
              const improved = await updateUrlData(existingShortCode, fresh);
              console.log(`[shorten] Successfully refreshed metadata for ${normalizedUrl}`);
              return NextResponse.json({
                shortCode: existingShortCode,
                metadata: improved ?? existingData
              });
            }
          } catch (refreshError) {
            console.error('Error refreshing metadata for existing URL:', refreshError);
          }
        }
        
        return NextResponse.json({
          shortCode: existingShortCode,
          metadata: existingData
        });
      }
    } catch (error) {
      console.error('Error checking existing URL:', error);
    }

    // For new URLs, fetch metadata first
    console.log(`[shorten] Creating new short URL for: ${normalizedUrl}`);
    const metadata = await fetchPageMetadata(normalizedUrl);
    
    // Create short code with the fetched metadata
    const shortCode = await createShortCode(normalizedUrl, metadata);
    
    // Get the final stored data to return
    const finalData = await getUrl(shortCode);
    
    return NextResponse.json({
      shortCode,
      metadata: finalData
    });
    
  } catch (error) {
    console.error('Error shortening URL:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}