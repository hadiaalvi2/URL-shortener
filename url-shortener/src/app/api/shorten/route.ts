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


async function fetchMetadataWithTimeout(url: string, timeoutMs = 8000): Promise<PageMetadata> {
  return Promise.race([
    fetchPageMetadata(url),
    new Promise<PageMetadata>((_, reject) => 
      setTimeout(() => reject(new Error('Metadata fetch timeout')), timeoutMs)
    )
  ]);
}

// Generate basic fallback metadata quickly
function generateFallbackMetadata(url: string): PageMetadata {
  try {
    const urlObj = new URL(url);
    const domain = urlObj.hostname.replace('www.', '');
    const domainTitle = domain.split('.').map(w => 
      w.charAt(0).toUpperCase() + w.slice(1)
    ).join(' ');
    
    return {
      title: domainTitle,
      description: `Visit ${domain}`,
      image: '',
      favicon: `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=128`
    };
  } catch {
    return {
      title: 'Shared Link',
      description: 'Click to view content',
      image: '',
      favicon: '/favicon.ico'
    };
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const { url, force } = await request.json();

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    console.log(`[shorten] Processing URL: ${url}, force: ${force}`);

    //Normalize URL quickly
    let normalizedUrl: string;
    try {
      let urlToParse = url.trim();
      if (!urlToParse.startsWith('http://') && !urlToParse.startsWith('https://')) {
        urlToParse = 'https://' + urlToParse;
      }
      const parsed = new URL(urlToParse);
      
      // Handle youtu.be redirects
      if (parsed.hostname === 'youtu.be') {
        const videoId = parsed.pathname.slice(1).split('?')[0];
        normalizedUrl = `https://www.youtube.com/watch?v=${videoId}`;
      } else {
        normalizedUrl = parsed.toString();
      }
      
      if (normalizedUrl.endsWith('/') && parsed.pathname === '/') {
        normalizedUrl = normalizedUrl.slice(0, -1);
      }
    } catch {
      return NextResponse.json({ error: 'Invalid URL format. Please enter a valid URL.' }, { status: 400 });
    }

    console.log(`[shorten] Normalized URL: ${normalizedUrl}`);

    //Check if URL already exists (quick KV lookup)
    const existingShortCode = await kv.get<string>(`url_to_code:${normalizedUrl}`);
    if (existingShortCode) {
      const existingData = await getUrl(existingShortCode);
      if (existingData) {
        //Only refresh metadata if forced or if we have time budget and weak metadata
        const elapsed = Date.now() - startTime;
        const shouldRefresh = force || (elapsed < 5000 && isWeakMetadata(existingData));
        
        console.log(`[shorten] Found existing data, should refresh: ${shouldRefresh}, elapsed: ${elapsed}ms`);
        
        if (shouldRefresh) {
          try {
            console.log(`[shorten] Quick metadata refresh attempt for existing URL`);
            const fresh = await fetchMetadataWithTimeout(normalizedUrl, 6000);
            
            if (fresh && (fresh.title || fresh.description || fresh.image)) {
              console.log(`[shorten] Successfully refreshed existing metadata`);
              const improved = await updateUrlData(existingShortCode, fresh);
              if (improved) {
                return NextResponse.json({ 
                  shortCode: existingShortCode, 
                  metadata: improved,
                  cached: true,
                  refreshed: true
                });
              }
            }
          } catch (err) {
            console.warn("[shorten] Quick metadata refresh failed, using cached data:", err);
          }
        }
        
        return NextResponse.json({ 
          shortCode: existingShortCode, 
          metadata: existingData,
          cached: true,
          refreshed: false
        });
      } else {
        // Clean up orphaned mapping
        await kv.del(`url_to_code:${normalizedUrl}`);
      }
    }

    //Create new short code with time-bounded metadata fetching
    console.log(`[shorten] Creating new short code for: ${normalizedUrl}`);
    
    // Start with fast fallback metadata
    let metadata: PageMetadata = generateFallbackMetadata(normalizedUrl);
    let metadataSource = 'fallback';
    
    // Try to fetch better metadata if we have time
    const elapsed = Date.now() - startTime;
    if (elapsed < 7000) { // Leave some time for the rest of the process
      try {
        console.log(`[shorten] Attempting metadata fetch (${7000 - elapsed}ms remaining)`);
        const fetchedMetadata = await fetchMetadataWithTimeout(normalizedUrl, Math.min(6000, 7000 - elapsed));
        
        if (fetchedMetadata) {
          // Validate quality and use if better than fallback
          const hasGoodTitle = fetchedMetadata.title && 
            fetchedMetadata.title.length > 5 && 
            !fetchedMetadata.title.match(/^[A-Z][a-z]+( [A-Z][a-z]+)*$/);
            
          const hasGoodDescription = fetchedMetadata.description && 
            fetchedMetadata.description.length > 20 &&
            !fetchedMetadata.description.startsWith('Visit ');
            
          const hasGoodImage = fetchedMetadata.image && 
            !fetchedMetadata.image.includes('google.com/s2/favicons');
          
          if (hasGoodTitle || hasGoodDescription || hasGoodImage) {
            metadata = {
              title: fetchedMetadata.title || metadata.title,
              description: fetchedMetadata.description || metadata.description,
              image: fetchedMetadata.image || metadata.image,
              favicon: fetchedMetadata.favicon || metadata.favicon,
            };
            metadataSource = 'fetched';
            console.log(`[shorten] Using fetched metadata (quality: good)`);
          } else {
            // Use fetched data but merge with fallback for missing pieces
            metadata = {
              title: fetchedMetadata.title || metadata.title,
              description: fetchedMetadata.description || metadata.description,
              image: fetchedMetadata.image || metadata.image,
              favicon: fetchedMetadata.favicon || metadata.favicon,
            };
            metadataSource = 'mixed';
            console.log(`[shorten] Using mixed metadata (quality: fair)`);
          }
        }
        
      } catch (err) {
        console.warn(`[shorten] Metadata fetch failed, using fallback:`, err);
        // Keep fallback metadata
      }
    } else {
      console.log(`[shorten] Skipping metadata fetch due to time constraints (${elapsed}ms elapsed)`);
    }

    const shortCode = await createShortCode(normalizedUrl, metadata);
    const finalData = await getUrl(shortCode);
    
    if (!finalData) {
      throw new Error("Failed to retrieve created short link data");
    }

    const totalTime = Date.now() - startTime;
    console.log(`[shorten] Successfully created short code: ${shortCode} in ${totalTime}ms`);

    return NextResponse.json({ 
      shortCode, 
      metadata: finalData,
      cached: false,
      refreshed: false,
      debug: {
        processingTime: totalTime,
        metadataSource,
        isWeakMetadata: isWeakMetadata(finalData)
      }
    });

  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`Error in shorten API after ${totalTime}ms:`, error);
  
    if (error instanceof Error && error.message.includes('timeout')) {
      return NextResponse.json(
        { error: 'Request took too long. The link was created but metadata may be limited.' },
        { status: 408 }
      );
    }
    
    return NextResponse.json(
      { error: 'Internal server error. Please try again.' },
      { status: 500 }
    );
  }
}