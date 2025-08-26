import { NextRequest, NextResponse } from "next/server"
import { createShortCode, getUrl, getAllUrls } from "@/lib/url-store"
import { kv } from "@vercel/kv";

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL!;

async function extractMetadata(url: string): Promise<{
  title?: string;
  description?: string;
  image?: string;
  favicon?: string;
}> {
  try {
    console.log(`[extractMetadata] Attempting to extract metadata for: ${url}`);
    const domain = new URL(url).hostname;
    
   
    const ogResponse = await fetch(`${baseUrl}/api/og?url=${encodeURIComponent(url)}`);
    const ogData = await ogResponse.json();

    console.log(`[extractMetadata] OG API response for ${url}:`, ogData);

    if (ogResponse.status !== 200 || ogData.error) {
      console.error('Error fetching OG metadata from API:', ogData.error || `Status: ${ogResponse.status}`);
    }

    // Fetch favicon using Google's service as primary method
    let favicon: string;
    try {
      const faviconResponse = await fetch(`${baseUrl}/api/favicon?domain=${encodeURIComponent(domain)}`);
      const faviconData = await faviconResponse.json();

      console.log(`[extractMetadata] Favicon API response for ${domain}:`, faviconData);
      
      if (faviconResponse.status === 200 && faviconData.favicon) {
        favicon = faviconData.favicon;
      } else {
        // Fallback to Google's favicon service directly
        favicon = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
      }
    } catch (faviconError) {
      console.error('Error fetching favicon:', faviconError);
 
      favicon = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
    }

   
    let image = ogData.image;
    if (image && !image.startsWith('http')) {
      try {
        const imageUrlBase = new URL(url);
        image = new URL(image, imageUrlBase.origin).toString();
      } catch (imageError) {
        console.error('Error resolving relative image URL:', imageError);
        image = undefined;
      }
    }

    const title = ogData.title || `Page from ${domain}`;
    const description = ogData.description || 'Check out this shared link';

    const finalMetadata = {
      title,
      description,
      image,
      favicon // This will always be a valid Google favicon URL
    };
    console.log(`[extractMetadata] Final metadata for ${url}:`, finalMetadata);
    return finalMetadata;
  } catch (error) {
    console.error('Error in extractMetadata during API calls:', error);
    const hostname = new URL(url).hostname;
    return {
      title: `Page from ${hostname}`,
      description: 'Check out this shared link',
      favicon: `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json()

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


    try {
      const existingShortCode = await kv.get<string>(`url_to_code:${normalizedUrl}`)
      
      if (existingShortCode) {
        const existingData = await getUrl(existingShortCode);
        return NextResponse.json({
          shortCode: existingShortCode,
          metadata: existingData
        });
      }
    } catch (error) {
      console.error('Error checking existing URL:', error);
     
    }

    
    const metadata = await extractMetadata(normalizedUrl);
    
    // Create short code
    const shortCode = await createShortCode(normalizedUrl, metadata);
    
    return NextResponse.json({ 
      shortCode,
      metadata
    });
    
  } catch (error) {
    console.error('Error shortening URL:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}