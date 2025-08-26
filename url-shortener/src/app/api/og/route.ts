import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const targetUrl = searchParams.get('url');

  if (!targetUrl) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  // Validate URL
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(targetUrl);
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    // Fetch the HTML from the original website
    const res = await fetch(targetUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      }
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      return NextResponse.json({ error: `Failed to fetch URL: ${res.status}` }, { status: res.status });
    }

    const html = await res.text();
    const $ = cheerio.load(html);

    const title = $('meta[property="og:title"]').attr('content') || $('title').text() || '';
    const description = $('meta[property="og:description"]').attr('content') || $('meta[name="description"]').attr('content') || '';
    let image = $('meta[property="og:image"]').attr('content') || $('meta[name="twitter:image"]').attr('content') || $('meta[name="twitter:image:src"]').attr('content') || '';

    // Resolve relative image URLs to absolute URLs
    if (image && !image.startsWith('http')) {
      try {
        image = new URL(image, parsedUrl.origin).toString();
      } catch (e) {
        console.error("Error resolving relative image URL:", e);
        image = ''; // Clear image if resolution fails
      }
    }

    // Enhanced favicon extraction from original website
    const favicon = await extractFavicon($, parsedUrl);

    return NextResponse.json({
      success: true,
      data: {
        title: title.trim(),
        description: description.trim(),
        image: image.trim(),
        favicon: favicon.trim()
      }
    });

  } catch (error: any) {
    console.error('Error fetching metadata:', error);
    
    if (error.name === 'AbortError') {
      return NextResponse.json({ error: 'Request timeout' }, { status: 408 });
    }
    
    return NextResponse.json({ 
      error: 'Error fetching metadata',
      details: error.message 
    }, { status: 500 });
  }
}

async function extractFavicon($: cheerio.CheerioAPI, baseUrl: URL): Promise<string> {
  // Try various favicon patterns in order of preference
  const faviconSelectors = [
    'link[rel="apple-touch-icon-precomposed"]',
    'link[rel="apple-touch-icon"]',
    'link[rel="icon"][type="image/svg+xml"]',
    'link[rel="icon"][type="image/png"]',
    'link[rel="icon"][sizes="192x192"]',
    'link[rel="icon"][sizes="180x180"]',
    'link[rel="icon"][sizes="32x32"]',
    'link[rel="icon"][sizes="16x16"]',
    'link[rel="icon"]',
    'link[rel="shortcut icon"]',
    'link[rel="mask-icon"]',
    'link[type="image/x-icon"]',
    'link[rel="fluid-icon"]'
  ];

  // Collect all possible favicon candidates
  const faviconCandidates: Array<{ href: string; size: number }> = [];

  for (const selector of faviconSelectors) {
    $(selector).each((_, el) => {
      const href = $(el).attr('href');
      if (!href) return;

      const resolvedUrl = resolveUrl(href, baseUrl);
      
      // Check for size attribute to pick the best one
      const sizes = $(el).attr('sizes');
      let size = 0;
      
      if (sizes) {
        const match = sizes.match(/(\d+)x(\d+)/);
        if (match) {
          size = parseInt(match[1], 10);
        }
      }

      faviconCandidates.push({ href: resolvedUrl, size });
    });
  }

  // Sort by size (largest first)
  faviconCandidates.sort((a, b) => b.size - a.size);

  // Try each candidate to see if it exists and is accessible
  for (const candidate of faviconCandidates) {
    try {
      const faviconRes = await fetch(candidate.href, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; LinkPreviewBot/1.0)'
        },
        timeout: 3000
      });

      if (faviconRes.ok && faviconRes.headers.get('content-type')?.includes('image')) {
        return candidate.href;
      }
    } catch (error) {
      // Continue to next candidate if this one fails
      console.log(`Favicon candidate failed: ${candidate.href}`);
    }
  }

  // Try the default favicon.ico
  const defaultFavicon = resolveUrl('/favicon.ico', baseUrl);
  try {
    const defaultRes = await fetch(defaultFavicon, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; LinkPreviewBot/1.0)'
      },
      timeout: 3000
    });

    if (defaultRes.ok && defaultRes.headers.get('content-type')?.includes('image')) {
      return defaultFavicon;
    }
  } catch (error) {
    console.log(`Default favicon failed: ${defaultFavicon}`);
  }

  // If all else fails, return the largest candidate URL even if we couldn't verify it
  if (faviconCandidates.length > 0) {
    return faviconCandidates[0].href;
  }

  return defaultFavicon;
}

function resolveUrl(url: string, baseUrl: URL): string {
  if (!url) return '';

  // Remove any leading/trailing whitespace
  url = url.trim();

  // Handle protocol-relative URLs (//example.com/favicon.ico)
  if (url.startsWith('//')) {
    return `${baseUrl.protocol}${url}`;
  }

  // Handle data URLs (data:image/svg+xml;base64,...)
  if (url.startsWith('data:')) {
    return url;
  }

  // Handle absolute URLs
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }

  // Handle root-relative URLs (/favicon.ico)
  if (url.startsWith('/')) {
    return `${baseUrl.origin}${url}`;
  }

  // Handle relative URLs (favicon.ico or ./favicon.ico)
  try {
    return new URL(url, baseUrl.origin).href;
  } catch {
    return `${baseUrl.origin}/${url}`;
  }
}

// Add fetch timeout support
declare global {
  interface RequestInit {
    timeout?: number;
  }
}

// Add timeout to fetch
const originalFetch = global.fetch;
global.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const controller = new AbortController();
  const timeoutId = init?.timeout ? setTimeout(() => controller.abort(), init.timeout) : null;

  try {
    const response = await originalFetch(input, {
      ...init,
      signal: controller.signal
    });
    return response;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};