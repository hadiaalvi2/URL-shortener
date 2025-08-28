import { NextRequest, NextResponse } from "next/server"
import { createShortCode, getUrl, getAllUrls, refreshUrlMetadata, isWeakMetadata } from "@/lib/url-store"
import { kv } from "@vercel/kv";
import { fetchPageMetadata } from "@/lib/utils";

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL!;

function validateAndNormalizeUrl(url: string): string {
  let urlToParse = url.trim();
  
  // Add protocol if missing
  if (!urlToParse.startsWith('http://') && !urlToParse.startsWith('https://')) {
    urlToParse = 'https://' + urlToParse;
  }
  
  const parsed = new URL(urlToParse);
  
  // Special handling for YouTube URLs
  if (parsed.hostname.includes('youtube.com') || parsed.hostname === 'youtu.be') {
    return normalizeYouTubeUrl(parsed);
  }
  
  let normalizedUrl = parsed.toString();
  
  // Remove trailing slash for consistency
  if (normalizedUrl.endsWith('/')) {
    normalizedUrl = normalizedUrl.slice(0, -1);
  }
  
  return normalizedUrl;
}

// YouTube URL normalization to ensure consistency
function normalizeYouTubeUrl(urlObj: URL): string {
  let videoId: string | null = null;
  
  if (urlObj.hostname.includes('youtube.com')) {
    // Standard watch URL
    videoId = urlObj.searchParams.get('v');
    
    // YouTube Shorts
    if (!videoId && urlObj.pathname.includes('/shorts/')) {
      videoId = urlObj.pathname.split('/shorts/')[1]?.split('?')[0];
    }
    
    // Embedded URLs
    if (!videoId) {
      const pathMatch = urlObj.pathname.match(/\/(?:watch|embed|v)\/([^\/\?&]+)/);
      if (pathMatch) {
        videoId = pathMatch[1];
      }
    }
  } else if (urlObj.hostname === 'youtu.be') {
    videoId = urlObj.pathname.slice(1).split('?')[0];
  }
  
  // Return normalized YouTube URL if we found a video ID
  if (videoId) {
    return `https://www.youtube.com/watch?v=${videoId}`;
  }
  
  // Fallback to original URL if we can't extract video ID
  return urlObj.toString();
}

// Check if URL is YouTube
function isYouTubeUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.includes('youtube.com') || urlObj.hostname === 'youtu.be';
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const { url, customCode } = await request.json();

    if (!url) {
      return NextResponse.json(
        { error: "URL is required" },
        { status: 400 }
      );
    }

    let normalizedUrl: string;
    try {
      normalizedUrl = validateAndNormalizeUrl(url);
    } catch (error) {
      return NextResponse.json(
        { error: "Invalid URL format" },
        { status: 400 }
      );
    }

    // Check if URL already exists
    try {
      const existingShortCode = await kv.get<string>(`url_to_code:${normalizedUrl}`);
      
      if (existingShortCode) {
        const existingData = await getUrl(existingShortCode);
        if (existingData) {
          console.log(`[POST] Found existing short code: ${existingShortCode}`);
          
          const shouldRefresh = isYouTubeUrl(normalizedUrl) || isWeakMetadata(existingData);
          
          if (shouldRefresh) {
            try {
              console.log(`[POST] Refreshing metadata for existing URL`);
              const freshMetadata = await fetchPageMetadata(normalizedUrl);
              
              if (freshMetadata.description && 
                  (!existingData.description || freshMetadata.description.length > existingData.description.length + 50)) {
                await refreshUrlMetadata(existingShortCode, true);
                console.log(`[POST] Successfully refreshed existing metadata`);
              }
            } catch (refreshError) {
              console.error('Error refreshing metadata for existing URL:', refreshError);
            }
          }
          
          return NextResponse.json({
            shortCode: existingShortCode,
            url: `${baseUrl}/${existingShortCode}`,
            originalUrl: normalizedUrl,
            existing: true
          });
        }
      }
    } catch (error) {
      console.error('Error checking existing URL:', error);
      // Continue with creating a new short code if checking fails
    }

    if (customCode) {
      if (!/^[a-zA-Z0-9_-]{4,20}$/.test(customCode)) {
        return NextResponse.json(
          { error: "Custom code must be 4-20 characters long and contain only letters, numbers, hyphens, and underscores" },
          { status: 400 }
        );
      }

      const existing = await getUrl(customCode);
      if (existing) {
        return NextResponse.json(
          { error: "Custom code already exists" },
          { status: 409 }
        );
      }

      // Create with custom code
      try {
        const metadata = await fetchPageMetadata(normalizedUrl);
        const isYouTube = isYouTubeUrl(normalizedUrl);
        
        const urlData = {
          originalUrl: normalizedUrl,
          title: metadata?.title,
          description: metadata?.description,
          image: metadata?.image,
          favicon: metadata?.favicon,
          isYouTube,
          lastUpdated: Date.now()
        };

        await kv.set(`url:${customCode}`, urlData);
        await kv.set(`url_to_code:${normalizedUrl}`, customCode);

        return NextResponse.json({
          shortCode: customCode,
          url: `${baseUrl}/${customCode}`,
          originalUrl: normalizedUrl,
          existing: false
        });
      } catch (error) {
        console.error('Error creating custom short code:', error);
        return NextResponse.json(
          { error: "Failed to create custom short code" },
          { status: 500 }
        );
      }
    }

    // Create new short code
    try {
      const shortCode = await createShortCode(normalizedUrl);
      
      return NextResponse.json({
        shortCode,
        url: `${baseUrl}/${shortCode}`,
        originalUrl: normalizedUrl,
        existing: false
      });
    } catch (error) {
      console.error('Error creating short code:', error);
      return NextResponse.json(
        { error: "Failed to create short code" },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Error in POST handler:', error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const shortCode = searchParams.get('code');

    if (shortCode) {
      // Get specific URL
      const urlData = await getUrl(shortCode);
      
      if (!urlData) {
        return NextResponse.json(
          { error: "Short code not found" },
          { status: 404 }
        );
      }

      return NextResponse.json({
        shortCode,
        originalUrl: urlData.originalUrl,
        title: urlData.title,
        description: urlData.description,
        image: urlData.image,
        favicon: urlData.favicon,
        isYouTube: urlData.isYouTube,
        lastUpdated: urlData.lastUpdated
      });
    } else {
      // Get all URLs (with pagination for large datasets)
      const urls = await getAllUrls();
      return NextResponse.json(urls);
    }
  } catch (error) {
    console.error('Error in GET handler:', error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const shortCode = searchParams.get('code');

    if (!shortCode) {
      return NextResponse.json(
        { error: "Short code is required" },
        { status: 400 }
      );
    }

    const urlData = await getUrl(shortCode);
    if (!urlData) {
      return NextResponse.json(
        { error: "Short code not found" },
        { status: 404 }
      );
    }

    // Delete both mappings
    await kv.del(`url:${shortCode}`);
    await kv.del(`url_to_code:${urlData.originalUrl}`);

    return NextResponse.json({
      message: "URL deleted successfully",
      shortCode
    });
  } catch (error) {
    console.error('Error in DELETE handler:', error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}