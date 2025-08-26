import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const targetUrl = searchParams.get('url');

  if (!targetUrl) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 seconds timeout

    const res = await fetch(targetUrl, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36' }
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`Failed to fetch ${targetUrl}: ${res.statusText}`);
    }

    const html = await res.text();
    const $ = cheerio.load(html);

    // Clean HTML by removing script and style tags to prevent parsing issues
    $('script').remove();
    $('style').remove();
    $('noscript').remove();
    $('iframe').remove();
    
    const title = $('meta[property="og:title"]').attr('content') || $('meta[name="twitter:title"]').attr('content') || $('title').text() || $('h1').first().text() || $('p').first().text();
    const description = $('meta[property="og:description"]').attr('content') || $('meta[name="twitter:description"]').attr('content') || $('meta[name="description"]').attr('content') || $('body').text().substring(0, 160);
    const image = $('meta[property="og:image"]').attr('content') || $('meta[name="twitter:image"]').attr('content') || $('meta[name="twitter:image:src"]').attr('content');

    // More robust favicon extraction with size prioritization
    const faviconCandidates: { href: string; size: number | null; type: string | null }[] = [];
    
    $('link[rel*="icon"]').each((_idx, el) => {
      const href = $(el).attr('href');
      const sizes = $(el).attr('sizes');
      const type = $(el).attr('type');

      if (href) {
        const size = sizes ? parseInt(sizes.split('x')[0]) : null;
        faviconCandidates.push({ href, size, type: type || null });
      }
    });

    // Sort candidates by size (descending), then by preferred type
    faviconCandidates.sort((a, b) => {
      if (a.size && b.size) {
        return b.size - a.size; // Prefer larger icons
      }
      if (a.type === 'image/svg+xml' && b.type !== 'image/svg+xml') return -1;
      if (b.type === 'image/svg+xml' && a.type !== 'image/svg+xml') return 1;
      return 0;
    });

    let favicon = faviconCandidates[0]?.href;

    // Fallback to common favicon paths if no explicit link tags are found
    if (!favicon) {
      const parsedUrl = new URL(targetUrl);
      const commonFavicons = [
        `/favicon.ico`,
        `/favicon.png`,
        `/apple-touch-icon.png`,
        `/apple-touch-icon-precomposed.png`,
      ];
      for (const path of commonFavicons) {
        const fullPath = `${parsedUrl.origin}${path}`;
        try {
          const headResponse = await fetch(fullPath, { method: 'HEAD', signal: controller.signal });
          if (headResponse.ok) {
            favicon = fullPath;
            break;
          }
        } catch (headError) {
          // Ignore error, try next fallback
        }
      }
    }

    // Ensure favicon is an absolute URL
    if (favicon && !favicon.startsWith('http')) {
      favicon = new URL(favicon, targetUrl).href;
    }
    console.log('Resolved Favicon URL (src/app/api/og/route.ts):', favicon);

    return NextResponse.json({
      title,
      description,
      image,
      favicon: favicon || undefined // Return undefined if no favicon is found to allow fallbacks in shorten route
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('Fetch to original URL timed out:', targetUrl);
      return new Response('Fetch to original URL timed out', { status: 504 });
    }
    console.error('Error fetching Open Graph metadata:', error);
    return new Response('Error fetching Open Graph metadata', { status: 500 });
  }
}