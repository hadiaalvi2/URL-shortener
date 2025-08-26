import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const targetUrl = searchParams.get('url');

  if (!targetUrl) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  try {
    const res = await fetch(targetUrl);
    const html = await res.text();
    const $ = cheerio.load(html);

    const title = $('meta[property="og:title"]').attr('content') || $('title').text();
    const description = $('meta[property="og:description"]').attr('content') || $('meta[name="description"]').attr('content');
    const image = $('meta[property="og:image"]').attr('content') || $('meta[name="twitter:image"]').attr('content') || $('meta[name="twitter:image:src"]').attr('content');

    // More robust favicon extraction logic
    let favicon = $('link[rel="apple-touch-icon"]').attr('href') ||
                  $('link[rel="apple-touch-icon-precomposed"]').attr('href') ||
                  $('link[rel*="icon"][sizes="192x192"]').attr('href') || 
                  $('link[rel*="icon"][sizes="180x180"]').attr('href') || 
                  $('link[rel*="icon"][sizes="32x32"]').attr('href') ||
                  $('link[rel*="icon"][sizes="16x16"]').attr('href') ||
                  $('link[rel="icon"][type="image/png"]').attr('href') ||
                  $('link[rel="icon"][type="image/svg+xml"]').attr('href') ||
                  $('link[rel="icon"]').attr('href') ||
                  $('link[rel="shortcut icon"]').attr('href') ||
                  $('link[type="image/x-icon"]').attr('href') ||
                  $('meta[itemprop="image"]').attr('content') || // Fallback for some sites
                  $('meta[property="og:image"]').attr('content') || // Use OG image as last resort if no favicon
                  undefined; // Explicitly undefined if no favicon is found
    if (favicon && !favicon.startsWith('http')) {
      try {
        favicon = new URL(favicon, targetUrl).href;
      } catch (e) {
        favicon = undefined; 
      }
    }

    return NextResponse.json({
      title,
      description,
      image,
      favicon
    });
  } catch (error) {
  console.error('Error fetching Open Graph metadata:', error)
  return new Response('Error fetching Open Graph metadata', { status: 500 })
}

}