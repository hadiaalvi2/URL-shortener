import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const targetUrl = searchParams.get('url');

  if (!targetUrl) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  try {
    // Validate and normalize the URL
    let normalizedUrl: string;
    try {
      const urlObj = new URL(targetUrl);
      normalizedUrl = urlObj.href;
    } catch (e: unknown) {
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    const res = await fetch(normalizedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      return NextResponse.json(
        { error: `Failed to fetch website: ${res.status} ${res.statusText}` },
        { status: res.status }
      );
    }

    const html = await res.text();
    const $ = cheerio.load(html);

    // Remove any script and style tags to clean up the HTML
    $('script, style, noscript, iframe').remove();

    const title = $('meta[property="og:title"]').attr('content') || 
                  $('meta[name="twitter:title"]').attr('content') || 
                  $('title').text().trim() ||
                  $('h1').first().text().trim();

    const description = $('meta[property="og:description"]').attr('content') || 
                        $('meta[name="twitter:description"]').attr('content') || 
                        $('meta[name="description"]').attr('content') ||
                        $('p').first().text().trim().substring(0, 200);

    const image = $('meta[property="og:image"]').attr('content') || 
                  $('meta[name="twitter:image"]').attr('content') || 
                  $('meta[name="twitter:image:src"]').attr('content') ||
                  $('meta[itemprop="image"]').attr('content');

    // Exhaustive favicon extraction logic
    let favicon: string | undefined = undefined;
    const faviconCandidates: { href: string; priority: number; sizes: string | null }[] = [];

    // Function to resolve relative URLs to absolute
    const resolveUrl = (url: string, baseUrl: string): string | undefined => {
      if (!url || url.startsWith('data:') || url.startsWith('javascript:')) {
        return undefined;
      }
      try {
        const absoluteUrl = new URL(url, baseUrl).href;
        return absoluteUrl;
      } catch (e) {
        return undefined;
      }
    };

    // High priority: Apple Touch Icons (often highest quality)
    $('link[rel="apple-touch-icon"], link[rel="apple-touch-icon-precomposed"]').each((_, el) => {
      const href = $(el).attr('href');
      const sizes = $(el).attr('sizes') || null;
      if (href) {
        faviconCandidates.push({ href, priority: 100, sizes });
      }
    });

    // High priority: Mask Icon (Safari Pinned Tabs)
    $('link[rel="mask-icon"]').each((_, el) => {
      const href = $(el).attr('href');
      if (href) {
        faviconCandidates.push({ href, priority: 95, sizes: null });
      }
    });

    // Standard Icons with Sizes (prioritize larger sizes)
    $('link[rel*="icon"]').each((_, el) => {
      const href = $(el).attr('href');
      const sizes = $(el).attr('sizes') || null;
      let priority = 80; // Default priority for generic icons

      if (sizes) {
        if (sizes.includes('192') || sizes.includes('180')) priority = 90;
        else if (sizes.includes('32')) priority = 85;
        else if (sizes.includes('16')) priority = 75;
      }
      if (href) {
        faviconCandidates.push({ href, priority, sizes });
      }
    });

    // Fallback to other icon types (png, svg, x-icon, etc.)
    $('link[rel="icon"][type="image/png"], link[rel="icon"][type="image/svg+xml"], link[rel="shortcut icon"], link[type="image/x-icon"]').each((_, el) => {
      const href = $(el).attr('href');
      if (href) {
        faviconCandidates.push({ href, priority: 70, sizes: null });
      }
    });

    // Sort candidates by priority (highest first)
    faviconCandidates.sort((a, b) => b.priority - a.priority);

    // Select the best favicon and make it absolute
    if (faviconCandidates.length > 0) {
      favicon = resolveUrl(faviconCandidates[0].href, targetUrl);
    }

    // Fallback to common favicon locations if no favicon found in meta tags
    if (!favicon) {
      const commonFaviconPaths = [
        '/apple-touch-icon.png',
        '/favicon.ico',
        '/favicon.png',
        '/favicon.gif',
        '/android-chrome-192x192.png',
      ];
      for (const path of commonFaviconPaths) {
        const resolvedPath = resolveUrl(path, targetUrl);
        if (resolvedPath) {
          // In a real scenario, you might want to perform a HEAD request here
          // to verify the favicon exists before setting it.
          favicon = resolvedPath;
          break;
        }
      }
    }
    
    console.log('Resolved Favicon URL (src/app/api/og/route.ts):', favicon);

    return NextResponse.json({
      success: true,
      data: {
        title: title || null,
        description: description || null,
        image: image ? resolveUrl(image, targetUrl) : null,
        favicon: favicon || null,
        url: normalizedUrl
      }
    });

  } catch (error: unknown) {
    console.error('Error fetching Open Graph metadata:', error);
    
    if (error instanceof Error && error.name === 'AbortError') {
      return NextResponse.json(
        { error: 'Request timeout - website took too long to respond' },
        { status: 408 }
      );
    }
    
    return NextResponse.json(
      { 
        error: 'Error fetching Open Graph metadata',
        details: (error as Error).message 
      },
      { status: 500 }
    );
  }
}