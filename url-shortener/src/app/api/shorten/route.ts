import { NextRequest, NextResponse } from "next/server"
import { createShortCode, getUrl } from "@/lib/url-store"
import { kv } from "@vercel/kv";
import { fetchPageMetadata } from "@/lib/utils"; 
import { isWeakMetadata, updateUrlData } from "@/lib/url-store";

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL!;

// Define interface for metadata
interface PageMetadata {
  title?: string;
  description?: string;
  image?: string;
  favicon?: string;
}

export async function POST(request: NextRequest) {
  try {
    const { url, force } = await request.json()

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 })
    }

    console.log(`[shorten] Processing URL: ${url}, force: ${force}`);

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
      
      console.log(`[shorten] Normalized URL: ${normalizedUrl}`);
    } catch (error) {
      console.error('URL validation error:', error);
      return NextResponse.json({ error: 'Invalid URL format. Please enter a valid URL.' }, { status: 400 })
    }

    // Check if URL already exists
    try {
      const existingShortCode = await kv.get<string>(`url_to_code:${normalizedUrl}`)
      
      if (existingShortCode) {
        console.log(`[shorten] Found existing short code: ${existingShortCode}`);
        const existingData = await getUrl(existingShortCode);
        
        if (existingData) {
          // If existing metadata is weak or user forces refresh, try to re-scrape and update
          if (force || isWeakMetadata(existingData)) {
            try {
              console.log(`[shorten] Refreshing metadata for existing URL: ${normalizedUrl}`);
              const fresh = await fetchPageMetadata(normalizedUrl);
              
              // Only update if we got meaningful fresh data
              if (fresh && (fresh.title || fresh.description || fresh.image)) {
                const improved = await updateUrlData(existingShortCode, fresh);
                if (improved) {
                  console.log(`[shorten] Successfully refreshed metadata for existing URL`);
                  return NextResponse.json({
                    shortCode: existingShortCode,
                    metadata: improved
                  });
                }
              }
            } catch (refreshError) {
              console.error('Error refreshing metadata for existing URL:', refreshError);
              // Continue with existing data if refresh fails
            }
          }
          
          console.log(`[shorten] Using existing data for: ${existingShortCode}`);
          return NextResponse.json({
            shortCode: existingShortCode,
            metadata: existingData
          });
        } else {
          // Clean up orphaned mapping
          console.warn(`[shorten] Found orphaned URL mapping, cleaning up`);
          await kv.del(`url_to_code:${normalizedUrl}`);
        }
      }
    } catch (error) {
      console.error('Error checking existing URL:', error);
      // Continue to create new short code if check fails
    }

    // For NEW URLs: Fetch metadata FIRST before creating short code
    let metadata: PageMetadata = {};
    try {
      console.log(`[shorten] Fetching fresh metadata for new URL: ${normalizedUrl}`);
      
      // Add a timeout to metadata fetching to prevent long waits
      const fetchPromise = fetchPageMetadata(normalizedUrl);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Metadata fetch timeout')), 15000)
      );
      
      metadata = await Promise.race([fetchPromise, timeoutPromise]) as PageMetadata;
      
      console.log(`[shorten] Fresh metadata fetched successfully:`, {
        title: metadata?.title ? `${metadata.title.substring(0, 50)}...` : 'none',
        description: metadata?.description ? `${metadata.description.substring(0, 50)}...` : 'none',
        hasImage: !!metadata?.image,
        hasFavicon: !!metadata?.favicon
      });
    } catch (metadataError) {
      console.error('Error fetching metadata for new URL:', metadataError);
      
      // Create basic fallback metadata
      try {
        const urlObj = new URL(normalizedUrl);
        const domain = urlObj.hostname.replace('www.', '');
        metadata = {
          title: domain.split('.').map(word => 
            word.charAt(0).toUpperCase() + word.slice(1)
          ).join(' '),
          description: `Visit ${domain}`,
          favicon: `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=128`
        };
        console.log(`[shorten] Using fallback metadata`);
      } catch (fallbackError) {
        console.error('Error creating fallback metadata:', fallbackError);
        metadata = {}; // Use empty metadata as last resort
      }
    }

    // Create short code with the fetched/fallback metadata
    let shortCode;
    try {
      shortCode = await createShortCode(normalizedUrl, metadata);
      console.log(`[shorten] Successfully created short code: ${shortCode}`);
    } catch (createError) {
      console.error('Error creating short code:', createError);
      throw new Error(`Failed to create short link: ${(createError as Error).message}`);
    }
    
    // Get the final stored data
    const finalData = await getUrl(shortCode);
    if (!finalData) {
      throw new Error('Failed to retrieve created short link data');
    }
    
    console.log(`[shorten] Successfully processed URL. Short code: ${shortCode}`);
    
    return NextResponse.json({
      shortCode,
      metadata: finalData
    });
    
  } catch (error) {
    console.error('Error in shorten API:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    const isUserError = errorMessage.includes('Invalid URL') || 
                       errorMessage.includes('Failed to create') ||
                       errorMessage.includes('Failed to retrieve');
    
    return NextResponse.json(
      { 
        error: isUserError ? errorMessage : 'Internal server error. Please try again.', 
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined 
      },
      { status: isUserError ? 400 : 500 }
    );
  }
}