import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const domain = searchParams.get('domain');

  if (!domain) {
    return NextResponse.json({ error: 'Missing domain parameter' }, { status: 400 });
  }

  try {
    const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
    return NextResponse.json({ favicon: faviconUrl });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch favicon' }, { status: 500 });
  }
}
