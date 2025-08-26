import { NextRequest, NextResponse } from "next/server"
import { createShortCode, getUrl, getAllUrls } from "@/lib/url-store"

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL!;

async function extractMetadata(url: string): Promise<{
  title?: string;
  description?: string;
  image?: string;
  favicon?: string;
}> {
  try {
    const ogResponse = await fetch(`${baseUrl}/api/og?url=${encodeURIComponent(url)}`);
    const ogData = await ogResponse.json();
    console.log('OG Data from API:', ogData); // Added log

    if (ogResponse.status !== 200 || ogData.error) {
      console.error('Error fetching OG metadata from API:', ogData.error || `Status: ${ogResponse.status}`);
    }

    const domain = new URL(url).hostname;
    const faviconResponse = await fetch(`${baseUrl}/api/favicon?domain=${encodeURIComponent(domain)}`);
    const faviconData = await faviconResponse.json();
    console.log('Favicon Data from API:', faviconData); // Added log

    if (faviconResponse.status !== 200 || faviconData.error) {
      console.error('Error fetching favicon from API:', faviconData.error || `Status: ${faviconResponse.status}`);
    }

    let image = ogData.image;
    // Handle relative image URLs if ogData.image is not absolute
    if (image && !image.startsWith('http')) {
      const baseUrl = new URL(url);
      image = new URL(image, baseUrl.origin).toString();
    }

    const title = ogData.title || `Page from ${domain}`;
    const description = ogData.description || 'Check out this shared link';
    const favicon = faviconData.favicon || `${new URL(url).origin}/favicon.ico`;

    return {
      title,
      description,
      image,
      favicon
    };
  } catch (error) {
    console.error('Error in extractMetadata during API calls:', error);
    const hostname = new URL(url).hostname;
    return {
      title: `Page from ${hostname}`,
      description: 'Check out this shared link',
      favicon: `${new URL(url).origin}/favicon.ico`
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json()

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 })
    }

    // Validate and normalize URL
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
      
      const existingShortCode = Object.entries(await getAllUrls()).find(
        ([_, storedUrl]) => storedUrl === normalizedUrl
      )?.[0];
      
      if (existingShortCode) {
        const existingData = await getUrl(existingShortCode);
        return NextResponse.json({ 
          shortCode: existingShortCode,
          metadata: existingData
        });
      }
    } catch (error) {
      console.error('Error checking existing URL:', error);
      // Continue with creating new short code
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