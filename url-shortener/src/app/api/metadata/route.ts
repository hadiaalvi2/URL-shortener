import { NextRequest, NextResponse } from "next/server"

async function extractFavicon(url: string, html: string): Promise<string> {
  const baseUrl = new URL(url);
  const origin = baseUrl.origin;
  
  const faviconPatterns = [
    /<link rel="icon" href="(.*?)"/i,
    /<link rel="shortcut icon" href="(.*?)"/i,
    /<link rel="apple-touch-icon" href="(.*?)"/i,
    /<link rel="apple-touch-icon-precomposed" href="(.*?)"/i,
    /<link rel="mask-icon" href="(.*?)"/i,
    /<link rel="fluid-icon" href="(.*?)"/i,
    /<meta name="msapplication-TileImage" content="(.*?)"/i,
    /<link[^>]*href="([^"]*\.ico)"[^>]*rel="[^"]*icon[^"]*"/i,
    /<link[^>]*rel="[^"]*icon[^"]*"[^>]*href="([^"]*)"/i
  ];

  for (const pattern of faviconPatterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      let faviconUrl = match[1];
      
      if (!faviconUrl.startsWith('http')) {
        if (faviconUrl.startsWith('//')) {
          faviconUrl = `https:${faviconUrl}`;
        } else if (faviconUrl.startsWith('/')) {
          faviconUrl = `${origin}${faviconUrl}`;
        } else {
          faviconUrl = `${origin}/${faviconUrl}`;
        }
      }
      
      return faviconUrl;
    }
  }

  return `${origin}/favicon.ico`;
}

async function extractMetadataFromTarget(url: string) {
  try {
    const hostname = new URL(url).hostname;
    
    try {
      const controller = new AbortController();
      // Increase timeout to 10 seconds
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'DNT': '1',
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const html = await response.text();
      
      const titleMatch = html.match(/<title>(.*?)<\/title>/i);
      const title = titleMatch ? titleMatch[1] : `Page from ${hostname}`;
      
      const descMatch = html.match(/<meta name="description" content="(.*?)"/i) || 
                         html.match(/<meta property="og:description" content="(.*?)"/i);
      const description = descMatch ? descMatch[1] : 'Check out this shared link';
      
      const imageMatch = html.match(/<meta property="og:image" content="(.*?)"/i) ||
                        html.match(/<meta name="twitter:image" content="(.*?)"/i) ||
                        html.match(/<link[^>]*rel=['"]image_src['"][^>]*href=['"](.*?)"['"]/i);
      const image = imageMatch && imageMatch[1] ? imageMatch[1] : undefined;

      const ogUrlMatch = html.match(/<meta property="og:url" content="(.*?)"/i);
      const ogUrl = ogUrlMatch ? ogUrlMatch[1] : url;

      const favicon = await extractFavicon(ogUrl, html);
      
      return {
        title,
        description,
        image,
        favicon
      };
      
    } catch (fetchError) {
      console.error('Error fetching page metadata:', fetchError);
      
      return {
        title: `Page from ${hostname}`,
        description: 'Check out this shared link',
        favicon: `${new URL(url).origin}/favicon.ico`
      };
    }
    
  } catch (error) {
    console.error('Error in extractMetadataFromTarget:', error);
    return {
      title: 'Shared Link',
      description: 'Check out this shared link'
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    
    const origin = request.headers.get('origin');
    const isInternalRequest = origin === process.env.NEXT_PUBLIC_BASE_URL || 
                             origin === 'http://localhost:3000' ||
                             origin === 'http://localhost:3001';
    
    if (!isInternalRequest) {
      const authHeader = request.headers.get('authorization');
      if (!authHeader || authHeader !== `Bearer ${process.env.API_SECRET}`) {
        console.warn('External metadata request without authentication');
    
      }
    }

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
    } catch (error) {
      console.error('Error normalizing URL:', error);
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
    }

    const metadata = await extractMetadataFromTarget(normalizedUrl)
    return NextResponse.json(metadata)
  } catch (error) {
    console.error('Error extracting metadata:', error)
    return NextResponse.json({ error: 'Failed to extract metadata' }, { status: 500 })
  }
}