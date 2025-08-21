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
    const image = $('meta[property="og:image"]').attr('content');
    const favicon = $('link[rel="icon"]').attr('href') || '/favicon.ico';

    return NextResponse.json({
      title,
      description,
      image,
      favicon: favicon.startsWith('http') ? favicon : new URL(favicon, targetUrl).href
    });
  } catch (error) {
  console.error('Error generating favicon:', error)
  return new Response('Error generating favicon', { status: 500 })
}

}