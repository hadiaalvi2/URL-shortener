import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const targetUrl = searchParams.get('url');

  if (!targetUrl) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  try {
    // Fetch with proper headers to avoid blocking
    const res = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; URL-Shortener-Bot/1.0)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'DNT': '1',
        'Connection': 'keep-alive'
      },
      timeout: 10000 // 10 second timeout
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch: ${res.status} ${res.statusText}`);
    }

    const html = await res.text();
    const $ = cheerio.load(html);

    // Extract title
    const title = $('meta[property="og:title"]').attr('content') || 
                  $('meta[name="twitter:title"]').attr('content') || 
                  $('title').text().trim() ||
                  '';

    // Extract description
    const description = $('meta[property="og:description"]').attr('content') || 
                       $('meta[name="twitter:description"]').attr('content') ||
                       $('meta[name="description"]').attr('content') ||
                       '';

   
    const image = $('meta[property="og:image"]').attr('content') || 
                  $('meta[name="twitter:image"]').attr('content') || 
                  $('meta[name="twitter:image:src"]').attr('content') ||
                  '';

    let favicon = '';
    
    const faviconSelectors = [
      'link[rel="icon"][type*="png"]',
      'link[rel="icon"][type*="svg"]',
      'link[rel="shortcut icon"]',
      'link[rel="icon"]',
      'link[rel="apple-touch-icon"]',
      'link[type="image/x-icon"]'
    ];

    for (const selector of faviconSelectors) {
      const faviconHref = $(selector).attr('href');
      if (faviconHref) {
        favicon = faviconHref;
        break;
      }
    }

    // If no favicon found in HTML, try common paths
    if (!favicon) {
      const commonPaths = ['/favicon.ico', '/favicon.png', '/apple-touch-icon.png'];
      for (const path of commonPaths) {
        try {
          const faviconUrl = new URL(path, targetUrl).href;
          const faviconRes = await fetch(faviconUrl, { 
            method: 'HEAD', 
            timeout: 5000,
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; URL-Shortener-Bot/1.0)'
            }
          });
          if (faviconRes.ok) {
            favicon = faviconUrl;
            break;
          }
        } catch {
          // Continue to next path
        }
      }
    }

    if (favicon && !favicon.startsWith('http')) {
      try {
        favicon = new URL(favicon, targetUrl).href;
      } catch {
        favicon = ''; 
      }
    }


    if (favicon) {
      try {
        const faviconTest = await fetch(favicon, { 
          method: 'HEAD', 
          timeout: 5000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; URL-Shortener-Bot/1.0)'
          }
        });
        if (!faviconTest.ok) {
          favicon = ''; 
        }
      } catch {
        favicon = ''; 
      }
    }

    return NextResponse.json({
      title: title || undefined,
      description: description || undefined,
      image: image || undefined,
      favicon: favicon || undefined 
    });
  } catch (error) {
    console.error('Error fetching Open Graph metadata:', error);
    return NextResponse.json(
      { 
        error: 'Error fetching Open Graph metadata',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    );
  }
}