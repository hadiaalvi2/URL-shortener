import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

// Helper function for fetch with timeout
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs: number = 10000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const targetUrl = searchParams.get('url');

  if (!targetUrl) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  try {
    // Fetch with proper headers to avoid blocking and with timeout
    const res = await fetchWithTimeout(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; URL-Shortener-Bot/1.0)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'DNT': '1',
        'Connection': 'keep-alive'
      }
    }, 10000); // 10 second timeout

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
          const faviconRes = await fetchWithTimeout(faviconUrl, { 
            method: 'HEAD',
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; URL-Shortener-Bot/1.0)'
            }
          }, 5000); // 5 second timeout for favicon checks
          
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
        const faviconTest = await fetchWithTimeout(favicon, { 
          method: 'HEAD',
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; URL-Shortener-Bot/1.0)'
          }
        }, 5000); // 5 second timeout for favicon validation
        
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
    
    let errorMessage = 'Error fetching Open Graph metadata';
    let statusCode = 500;
    
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        errorMessage = 'Request timeout - the server took too long to respond';
        statusCode = 408; // Request Timeout
      } else {
        errorMessage = error.message;
      }
    }
    
    return NextResponse.json(
      { 
        error: errorMessage,
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: statusCode }
    );
  }
}