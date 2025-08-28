import { NextRequest, NextResponse } from "next/server"
import { createShortCode, getUrl } from "@/lib/url-store"
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
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
    }

    // Check if URL already exists
    try {
      const existingShortCode = await kv.get<string>(`url_to_code:${normalizedUrl}`)
      
      if (existingShortCode) {
        const existingData = await getUrl(existingShortCode);
        
        // If existing metadata is weak or user forces refresh, try to re-scrape and update
        if (force || (existingData && isWeakMetadata(existingData))) {
          try {
            console.log(`[shorten] Refreshing metadata for existing URL: ${normalizedUrl}`);
            const fresh = await fetchPageMetadata(normalizedUrl);
            const improved = await updateUrlData(existingShortCode, fresh);
            return NextResponse.json({
              shortCode: existingShortCode,
              metadata: improved ?? existingData
            });
          } catch (refreshError) {
            console.error('Error refreshing metadata for existing URL:', refreshError);
            // Continue with existing data if refresh fails
          }
        }
        return NextResponse.json({
          shortCode: existingShortCode,
          metadata: existingData
        });
      }
    } catch (error) {
      console.error('Error checking existing URL:', error);
      // Continue to create new short code if check fails
    }

    // For NEW URLs: Fetch metadata FIRST before creating short code
    let metadata;
    try {
      console.log(`[shorten] Fetching metadata for new URL: ${normalizedUrl}`);
      metadata = await fetchPageMetadata(normalizedUrl);
      console.log(`[shorten] Metadata fetched:`, {
        title: metadata?.title,
        description: metadata?.description ? `${metadata.description.substring(0, 50)}...` : 'none',
        hasImage: !!metadata?.image,
        hasFavicon: !!metadata?.favicon
      });
    } catch (metadataError) {
      console.error('Error fetching metadata for new URL:', metadataError);
      metadata = {}; // Use empty metadata as fallback
    }

 
    const shortCode = await createShortCode(normalizedUrl, metadata);
    
 
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