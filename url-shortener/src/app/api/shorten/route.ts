import { NextRequest, NextResponse } from "next/server"
import { createShortCode, getUrl } from "@/lib/url-store"

async function extractMetadata(url: string): Promise<{
  title?: string;
  description?: string;
  image?: string;
  favicon?: string;
}> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; LinkPreviewBot/1.0; +http://linkpreviewbot.com)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const html = await response.text();
    const hostname = new URL(url).hostname;
    
    // Extract title
    const titleMatch = html.match(/<title>(.*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : `Page from ${hostname}`;
    
    // Extract description
    const descMatch = html.match(/<meta name="description" content="(.*?)"/i) || 
                     html.match(/<meta property="og:description" content="(.*?)"/i);
    const description = descMatch ? descMatch[1].trim() : 'Check out this shared link';
    
    // Extract image
    const imageMatch = html.match(/<meta property="og:image" content="(.*?)"/i) ||
                      html.match(/<meta name="twitter:image:src" content="(.*?)"/i) ||
                      html.match(/<meta name="twitter:image" content="(.*?)"/i);
    let image = imageMatch ? imageMatch[1] : undefined;

    // Handle relative image URLs
    if (image && !image.startsWith('http')) {
      const baseUrl = new URL(url);
      image = new URL(image, baseUrl.origin).toString();
    }
    
    // Extract favicon
    const faviconMatch = html.match(/<link rel="icon" href="(.*?)"/i) ||
                        html.match(/<link rel="shortcut icon" href="(.*?)"/i) ||
                        html.match(/<link rel="apple-touch-icon" href="(.*?)"/i) ||
                        html.match(/<link rel="icon" type="image\/x-icon" href="(.*?)"/i);
    
    let favicon = faviconMatch ? faviconMatch[1] : `${new URL(url).origin}/favicon.ico`;
    
    if (favicon && !favicon.startsWith('http')) {
      const baseUrl = new URL(url);
      favicon = new URL(favicon, baseUrl.origin).toString();
    }
    
    return {
      title,
      description,
      image,
      favicon
    };
    
  } catch (error) {
    console.error('Error extracting metadata:', error);
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
        const existingData = getUrl(existingShortCode);
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
    const shortCode = createShortCode(normalizedUrl, metadata);
    
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