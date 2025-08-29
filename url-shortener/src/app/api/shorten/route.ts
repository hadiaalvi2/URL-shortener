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

    // Enhanced URL validation and normalization
    let normalizedUrl: string;
    try {
      let urlToParse = url.trim();
      
      // Handle various URL formats
      if (!urlToParse.startsWith('http://') && !urlToParse.startsWith('https://')) {
        // Check if it looks like a domain without protocol
        if (urlToParse.includes('.') && !urlToParse.includes(' ')) {
          urlToParse = 'https://' + urlToParse;
        } else {
          return NextResponse.json({ 
            error: 'Invalid URL format. Please enter a valid URL (e.g., https://example.com or example.com).' 
          }, { status: 400 });
        }
      }
      
      const parsed = new URL(urlToParse);
      
      // Validate that it's a reasonable URL
      if (!parsed.hostname || parsed.hostname.length < 3) {
        return NextResponse.json({ 
          error: 'Invalid domain name. Please enter a valid URL.' 
        }, { status: 400 });
      }
      
      normalizedUrl = parsed.toString();
      if (normalizedUrl.endsWith('/') && parsed.pathname === '/') {
        normalizedUrl = normalizedUrl.slice(0, -1);
      }
      
      console.log(`[shorten] Normalized URL: ${normalizedUrl}`);
    } catch (error) {
      console.error(`[shorten] URL parsing error:`, error);
      return NextResponse.json({ 
        error: 'Invalid URL format. Please enter a valid URL (e.g., https://example.com).' 
      }, { status: 400 });
    }

    // Check if URL already exists
    const existingShortCode = await kv.get<string>(`url_to_code:${normalizedUrl}`);
    if (existingShortCode) {
      console.log(`[shorten] Found existing short code: ${existingShortCode}`);
      
      const existingData = await getUrl(existingShortCode);
      if (existingData) {
        const shouldRefresh = force || 
                            isWeakMetadata(existingData) || 
                            (!existingData.lastUpdated || 
                             Date.now() - existingData.lastUpdated > 6 * 60 * 60 * 1000); // 6 hours
        
        if (shouldRefresh) {
          console.log(`[shorten] Refreshing metadata for existing URL (force: ${force}, weak: ${isWeakMetadata(existingData)})`);
          
          try {
            // Use a longer timeout for forced refreshes
            const timeoutMs = force ? 45000 : 25000;
            
            const fresh = await Promise.race([
              fetchPageMetadata(normalizedUrl),
              new Promise<null>((_, reject) => 
                setTimeout(() => reject(new Error('Metadata refresh timeout')), timeoutMs)
              )
            ]);
            
            if (fresh && (fresh.title || fresh.description || fresh.image)) {
              console.log(`[shorten] Fresh metadata obtained:`, {
                title: fresh.title ? `${fresh.title.substring(0, 50)}...` : 'none',
                description: fresh.description ? `${fresh.description.substring(0, 50)}...` : 'none',
                hasImage: !!fresh.image,
                hasFavicon: !!fresh.favicon,
              });
              
              const improved = await updateUrlData(existingShortCode, fresh as PageMetadata);
              if (improved) {
                return NextResponse.json({ 
                  shortCode: existingShortCode, 
                  metadata: improved,
                  refreshed: true 
                });
              }
            }
          } catch (err) {
            console.warn("[shorten] Metadata refresh failed:", err);
            // Don't fail the request, just return existing data
          }
        }
        
        console.log(`[shorten] Returning existing data for: ${existingShortCode}`);
        return NextResponse.json({ 
          shortCode: existingShortCode, 
          metadata: existingData,
          refreshed: false 
        });
      } else {
        // Clean up orphaned mapping
        console.warn(`[shorten] Cleaning up orphaned mapping for: ${normalizedUrl}`);
        await kv.del(`url_to_code:${normalizedUrl}`);
      }
    }

    // Create new short code with enhanced metadata fetching
    console.log(`[shorten] Creating new short code for: ${normalizedUrl}`);
    
    let initialMetadata: PageMetadata = {};
    
    // Pre-fetch metadata with timeout
    try {
      console.log(`[shorten] Pre-fetching metadata...`);
      
      const metadataPromise = fetchPageMetadata(normalizedUrl);
      const timeoutPromise = new Promise<null>((_, reject) => 
        setTimeout(() => reject(new Error('Pre-fetch timeout')), 35000)
      );
      
      const fetchedMetadata = await Promise.race([metadataPromise, timeoutPromise]);
      
      if (fetchedMetadata) {
        initialMetadata = fetchedMetadata as PageMetadata;
        console.log(`[shorten] Pre-fetched metadata:`, {
          title: initialMetadata.title ? `${initialMetadata.title.substring(0, 50)}...` : 'none',
          description: initialMetadata.description ? `${initialMetadata.description.substring(0, 50)}...` : 'none',
          hasImage: !!initialMetadata.image,
          hasFavicon: !!initialMetadata.favicon,
        });
      }
    } catch (error) {
      console.warn("[shorten] Pre-fetch failed, will use fallback:", error);
      // Create basic fallback metadata
      try {
        const urlObj = new URL(normalizedUrl);
        const domain = urlObj.hostname.replace('www.', '');
        initialMetadata = {
          title: domain.split('.').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
          description: `Visit ${domain}`,
          favicon: `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=128`
        };
      } catch {
        initialMetadata = {
          title: "Website",
          description: "",
          favicon: "/favicon.ico"
        };
      }
    }

    // Create the short code with the metadata
    const shortCode = await createShortCode(normalizedUrl, initialMetadata);
    const finalData = await getUrl(shortCode);
    
    if (!finalData) {
      throw new Error("Failed to retrieve created short link data");
    }

    console.log(`[shorten] Successfully created short code: ${shortCode}`);
    return NextResponse.json({ 
      shortCode, 
      metadata: finalData,
      created: true 
    });

  } catch (error) {
    console.error('Error in shorten API:', error);
    
    // Provide more specific error messages
    if (error instanceof Error) {
      if (error.message.includes('timeout') || error.message.includes('Timeout')) {
        return NextResponse.json({
          error: 'The website took too long to respond. Please try again or check if the URL is accessible.'
        }, { status: 408 });
      }
      
      if (error.message.includes('network') || error.message.includes('fetch')) {
        return NextResponse.json({
          error: 'Unable to access the website. Please check the URL and try again.'
        }, { status: 400 });
      }
      
      if (error.message.includes('Invalid')) {
        return NextResponse.json({
          error: error.message
        }, { status: 400 });
      }
    }
    
    return NextResponse.json(
      { error: 'Internal server error. Please try again.' },
      { status: 500 }
    );
  }
}