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

    // More robust favicon extraction
    let favicon = $('link[rel="apple-touch-icon"]').attr('href') ||
                  $('link[rel="icon"][type="image/png"]').attr('href') ||
                  $('link[rel="icon"][type="image/svg+xml"]').attr('href') ||
                  $('link[rel="icon"]').attr('href') ||
                  $('link[rel="shortcut icon"]').attr('href') ||
                  $('link[type="image/x-icon"]').attr('href') ||
                  '/favicon.ico';

    // Ensure favicon is an absolute URL
    if (favicon && !favicon.startsWith('http')) {
      favicon = new URL(favicon, targetUrl).href;
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