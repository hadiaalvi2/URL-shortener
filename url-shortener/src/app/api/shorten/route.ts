import { NextRequest, NextResponse } from "next/server"
import { createShortCode, getUrl, isWeakMetadata, updateUrlData } from "@/lib/url-store"
import { kv } from "@vercel/kv";
// import { fetchPageMetadataFast } from "@/lib/utils-fast"; 

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
      
      if (existingShortCode && !force) {
        const existingData = await getUrl(existingShortCode);
        return NextResponse.json({
          shortCode: existingShortCode,
          metadata: existingData
        });
      }
    } catch (error) {
      console.error('Error checking existing URL:', error);
    }

    // Create short code first with basic metadata
    const basicMetadata = {
      title: new URL(normalizedUrl).hostname,
      description: undefined,
      image: undefined,
      favicon: `https://www.google.com/s2/favicons?domain=${new URL(normalizedUrl).hostname}&sz=128`
    };
    
    const shortCode = await createShortCode(normalizedUrl, basicMetadata);
    
    // Return immediately with basic metadata
    const response = NextResponse.json({
      shortCode,
      metadata: basicMetadata
    });

    // Trigger background metadata enhancement (fire and forget)
    // This will update the stored data without making the user wait
    enhanceMetadataInBackground(shortCode, normalizedUrl).catch(console.error);
    
    return response;
    
  } catch (error) {
    console.error('Error shortening URL:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Background function to enhance metadata without blocking the response
async function enhanceMetadataInBackground(shortCode: string, url: string) {
  try {
    console.log(`[Background] Starting metadata enhancement for: ${url}`);
    const enhancedMetadata = await fetchPageMetadataFast(url);
    
    if (enhancedMetadata.title || enhancedMetadata.description || enhancedMetadata.image) {
      await updateUrlData(shortCode, enhancedMetadata);
      console.log(`[Background] Enhanced metadata for ${shortCode}:`, enhancedMetadata);
    }
  } catch (error) {
    console.error(`[Background] Failed to enhance metadata for ${shortCode}:`, error);
  }
}