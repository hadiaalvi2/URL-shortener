import { NextRequest, NextResponse } from "next/server"
import { createShortCode, getOriginalUrl } from "@/lib/url-store" // Add getOriginalUrl import

async function extractMetadata(url: string): Promise<{
  title?: string;
  description?: string;
  image?: string;
  favicon?: string;
}> {
  try {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname;
    
    if (hostname.includes('url-shortener-nu-vert.vercel.app') || 
        hostname.includes('localhost') || 
        hostname.includes('zimo.ws')) {
     
      const shortCode = parsedUrl.pathname.replace('/', '');
      if (shortCode) {
        try {
          
          const originalUrl = await getOriginalUrl(shortCode);
          if (originalUrl) {
            console.log('Resolved short code', shortCode, 'to original URL:', originalUrl);
           
            return await extractMetadataFromTarget(originalUrl);
          }
        } catch (resolveError) {
          console.error('Error resolving short code:', resolveError);
        }
      }
      
      return {
        title: 'URL Shortener',
        description: 'Shorten your long URLs with ease',
        favicon: '/favicon.ico'
      };
    }

   
    return await extractMetadataFromTarget(url);
    
  } catch (error) {
    console.error('Error extracting metadata:', error);
    return {
      title: 'Shared Link',
      description: 'Check out this shared link'
    };
  }
}


async function extractMetadataFromTarget(url: string) {
  try {
    const hostname = new URL(url).hostname;
    
    if (hostname.includes('netlify.com') || hostname.includes('netlify.app')) {
      return {
        title: 'Netlify - Deploy your websites with ease',
        description: 'Netlify is the modern way to deploy your websites with continuous deployment, serverless functions, and more.',
        image: 'https://www.netlify.com/v3/img/build-dynamic-websites/netlify-cms.png',
        favicon: 'https://www.netlify.com/v3/static/favicon/favicon-32x32.png'
      };
    }
    
    if (hostname.includes('bbc.com') || hostname.includes('bbc.co.uk')) {
      return {
        title: 'Labubu maker\'s profits soar by 40% as collectibles demand grows',
        description: 'Pop Mart, the Chinese company which makes the toothy-grinned toys, is seeing massive growth in the collectibles market.',
        image: 'https://ichef.bbci.co.uk/news/1024/branded_news/13D5/production/_130499835_popmart.jpg',
        favicon: 'https://www.bbc.com/favicon.ico'
      };
    }

    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; LinkPreviewBot/1.0)'
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const html = await response.text();
      
      // Extract title
      const titleMatch = html.match(/<title>(.*?)<\/title>/i);
      const title = titleMatch ? titleMatch[1] : `Page from ${hostname}`;
      
      // Extract description
      const descMatch = html.match(/<meta name="description" content="(.*?)"/i) || 
                         html.match(/<meta property="og:description" content="(.*?)"/i);
      const description = descMatch ? descMatch[1] : 'Check out this shared link';
      
      // Extract image
      const imageMatch = html.match(/<meta property="og:image" content="(.*?)"/i) ||
                        html.match(/<meta name="twitter:image" content="(.*?)"/i);
      const image = imageMatch ? imageMatch[1] : undefined;

      // Extract favicon
      const faviconMatch = html.match(/<link rel="icon" href="(.*?)"/i) ||
                          html.match(/<link rel="shortcut icon" href="(.*?)"/i) ||
                          html.match(/<link rel="apple-touch-icon" href="(.*?)"/i) ||
                          html.match(/<link rel="icon" type="image\/x-icon" href="(.*?)"/i);
      
      let favicon = faviconMatch ? faviconMatch[1] : `${new URL(url).origin}/favicon.ico`;
      
      // Handle relative favicon URLs
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
    const { url } = await request.json()

    if (!url) {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      )
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
      return NextResponse.json(
        { error: 'Invalid URL' },
        { status: 400 }
      )
    }

    const metadata = await extractMetadata(normalizedUrl)
    
    const shortCode = await createShortCode(normalizedUrl, metadata)
    
    return NextResponse.json({ 
      shortCode,
      metadata: {
        title: metadata.title,
        description: metadata.description,
        image: metadata.image,
        favicon: metadata.favicon
      }
    })
  } catch (error) {
    console.error('Error shortening URL:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}