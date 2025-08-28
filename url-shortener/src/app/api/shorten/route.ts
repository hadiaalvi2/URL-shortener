import { NextRequest, NextResponse } from "next/server"
import { createShortCode, getUrl, isWeakMetadata, updateUrlData } from "@/lib/url-store"
import { kv } from "@vercel/kv";
import { fetchPageMetadata } from "@/lib/utils"; 

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL!;

interface PageMetadata {
  title?: string;
  description?: string;
  image?: string;
  favicon?: string;
}

export async function POST(request: NextRequest) {
  try {
    const { url, force } = await request.json();

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    console.log(`[shorten] Processing URL: ${url}, force: ${force}`);

    // ✅ Normalize URL
    let normalizedUrl: string;
    try {
      let urlToParse = url.trim();
      if (!urlToParse.startsWith('http://') && !urlToParse.startsWith('https://')) {
        urlToParse = 'https://' + urlToParse;
      }
      const parsed = new URL(urlToParse);
      normalizedUrl = parsed.toString();
      if (normalizedUrl.endsWith('/')) {
        normalizedUrl = normalizedUrl.slice(0, -1);
      }
    } catch {
      return NextResponse.json({ error: 'Invalid URL format. Please enter a valid URL.' }, { status: 400 });
    }

    // ✅ Check if URL already exists
    const existingShortCode = await kv.get<string>(`url_to_code:${normalizedUrl}`);
    if (existingShortCode) {
      const existingData = await getUrl(existingShortCode);
      if (existingData) {
        if (force || isWeakMetadata(existingData)) {
          try {
            const fresh = await Promise.race([
              fetchPageMetadata(normalizedUrl),
              new Promise<null>((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
            ]);
            if (fresh && (fresh.title || fresh.description || fresh.image)) {
              const improved = await updateUrlData(existingShortCode, fresh as PageMetadata);
              return NextResponse.json({ shortCode: existingShortCode, metadata: improved });
            }
          } catch (err) {
            console.warn("[shorten] Metadata refresh failed, using old data");
          }
        }
        return NextResponse.json({ shortCode: existingShortCode, metadata: existingData });
      } else {
        await kv.del(`url_to_code:${normalizedUrl}`);
      }
    }

    let metadata: PageMetadata = {};
    try {
      metadata = await Promise.race([
        fetchPageMetadata(normalizedUrl),
        new Promise<null>((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
      ]) as PageMetadata;
    } catch {
      console.warn("[shorten] Metadata fetch timeout or failed, using fallback metadata");
      try {
        const urlObj = new URL(normalizedUrl);
        const domain = urlObj.hostname.replace('www.', '');
        metadata = {
          title: domain.split('.').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
          description: `Visit ${domain}`,
          favicon: `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=128`
        };
      } catch {
        metadata = {};
      }
    }

 
    const shortCode = await createShortCode(normalizedUrl, metadata);
    const finalData = await getUrl(shortCode);
    if (!finalData) throw new Error("Failed to retrieve created short link data");

    return NextResponse.json({ shortCode, metadata: finalData });

  } catch (error) {
    console.error('Error in shorten API:', error);
    return NextResponse.json(
      { error: 'Internal server error. Please try again.' },
      { status: 500 }
    );
  }
}
