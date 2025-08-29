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

    // ✅ Check if URL already exists
    const existingShortCode = await kv.get<string>(`url_to_code:${normalizedUrl}`);
    if (existingShortCode) {
      const existingData = await getUrl(existingShortCode);
      if (existingData) {
        // Always check if we should refresh metadata
        const shouldRefresh = force || isWeakMetadata(existingData);
        
        console.log(`[shorten] Found existing data, should refresh: ${shouldRefresh}`);
        
        if (shouldRefresh) {
          try {
            console.log(`[shorten] Refreshing metadata for existing URL`);
            const fresh = await fetchPageMetadata(normalizedUrl);
            
            if (fresh && (fresh.title || fresh.description || fresh.image)) {
              console.log(`[shorten] Successfully refreshed metadata:`, {
                oldTitle: existingData.title?.substring(0, 30),
                newTitle: fresh.title?.substring(0, 30),
                oldDesc: existingData.description?.substring(0, 30),
                newDesc: fresh.description?.substring(0, 30)
              });
              
              const improved = await updateUrlData(existingShortCode, fresh as PageMetadata);
              if (improved) {
                return NextResponse.json({ shortCode: existingShortCode, metadata: improved });
              }
            }
          } catch (err) {
            console.warn("[shorten] Metadata refresh failed for existing URL:", err);
          }
        }
        
        return NextResponse.json({ shortCode: existingShortCode, metadata: existingData });
      } else {
        // Clean up orphaned mapping
        await kv.del(`url_to_code:${normalizedUrl}`);
      }
    }

    // ✅ Create new short code with aggressive metadata fetching
    console.log(`[shorten] Creating new short code for: ${normalizedUrl}`);
    
    let metadata: PageMetadata = {};
    let metadataFetchSuccessful = false;
    
    // Try multiple times to get good metadata
    const maxMetadataAttempts = 2;
    
    for (let attempt = 1; attempt <= maxMetadataAttempts; attempt++) {
      try {
        console.log(`[shorten] Metadata fetch attempt ${attempt}/${maxMetadataAttempts}`);
        
        const fetchedMetadata = await Promise.race([
          fetchPageMetadata(normalizedUrl),
          new Promise<null>((_, reject) => 
            setTimeout(() => reject(new Error('timeout')), 15000)
          )
        ]);
        
        if (fetchedMetadata) {
          // Validate quality of fetched metadata
          const hasGoodTitle = fetchedMetadata.title && 
            fetchedMetadata.title.length > 5 && 
            !fetchedMetadata.title.match(/^[A-Z][a-z]+( [A-Z][a-z]+)*$/);
            
          const hasGoodDescription = fetchedMetadata.description && 
            fetchedMetadata.description.length > 20 &&
            !fetchedMetadata.description.startsWith('Visit ');
            
          const hasGoodImage = fetchedMetadata.image && 
            !fetchedMetadata.image.includes('google.com/s2/favicons');
          
          console.log(`[shorten] Metadata quality check:`, {
            hasGoodTitle,
            hasGoodDescription,
            hasGoodImage,
            title: fetchedMetadata.title?.substring(0, 50),
            description: fetchedMetadata.description?.substring(0, 50)
          });
          
          // If we got at least decent metadata, use it
          if (hasGoodTitle || hasGoodDescription || hasGoodImage) {
            metadata = fetchedMetadata as PageMetadata;
            metadataFetchSuccessful = true;
            console.log(`[shorten] Successfully fetched good metadata on attempt ${attempt}`);
            break;
          } else if (attempt === maxMetadataAttempts) {
            // Use whatever we got on the last attempt
            metadata = fetchedMetadata as PageMetadata;
            metadataFetchSuccessful = true;
            console.log(`[shorten] Using available metadata from final attempt`);
          }
        }
        
      } catch (err) {
        console.warn(`[shorten] Metadata fetch attempt ${attempt} failed:`, err);
        
        if (attempt < maxMetadataAttempts) {
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }
    
    // If metadata fetch failed completely, create fallback
    if (!metadataFetchSuccessful) {
      console.warn("[shorten] All metadata fetch attempts failed, using fallback");
      try {
        const urlObj = new URL(normalizedUrl);
        const domain = urlObj.hostname.replace('www.', '');
        const domainTitle = domain.split('.').map(w => 
          w.charAt(0).toUpperCase() + w.slice(1)
        ).join(' ');
        
        metadata = {
          title: domainTitle,
          description: `Visit ${domain}`,
          image: '',
          favicon: `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=128`
        };
      } catch {
        metadata = {
          title: 'Shared Link',
          description: '',
          image: '',
          favicon: '/favicon.ico'
        };
      }
    }

    // Create the short code
    const shortCode = await createShortCode(normalizedUrl, metadata);
    const finalData = await getUrl(shortCode);
    
    if (!finalData) {
      throw new Error("Failed to retrieve created short link data");
    }

    console.log(`[shorten] Successfully created short code: ${shortCode}`, {
      title: finalData.title,
      hasDescription: !!finalData.description,
      hasImage: !!finalData.image,
      hasFavicon: !!finalData.favicon
    });

    return NextResponse.json({ 
      shortCode, 
      metadata: finalData,
      debug: {
        metadataFetchSuccessful,
        isWeakMetadata: isWeakMetadata(finalData)
      }
    });

  } catch (error) {
    console.error('Error in shorten API:', error);
    return NextResponse.json(
      { error: 'Internal server error. Please try again.' },
      { status: 500 }
    );
  }
}