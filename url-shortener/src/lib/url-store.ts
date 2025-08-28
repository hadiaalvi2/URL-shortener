import { kv } from "@vercel/kv"
import { fetchPageMetadata } from "@/lib/utils"

export interface UrlData {
  originalUrl: string
  title?: string
  description?: string
  image?: string
  favicon?: string
  lastUpdated?: number
  isYouTube?: boolean
}

export interface UrlStorage {
  codeToUrl: Record<string, UrlData>
  urlToCode: Record<string, string>
}

// Vercel KV functions
export async function getUrlFromKV(shortCode: string): Promise<UrlData | null> {
  console.log(`[getUrlFromKV] Getting URL data for short code: ${shortCode}`);
  const data = await kv.get<UrlData>(`url:${shortCode}`);
  console.log(`[getUrlFromKV] Data for ${shortCode}:`, data ? 'Found' : 'Not found');
  return data;
}

export async function saveUrlToKV(shortCode: string, data: UrlData) {
  console.log(`[saveUrlToKV] Saving URL data for ${shortCode}`);
  await kv.set(`url:${shortCode}`, {
    ...data,
    lastUpdated: Date.now()
  });
}

// Enhanced function to detect weak metadata with better YouTube-specific patterns
export function isWeakMetadata(data?: Partial<UrlData> | null): boolean {
  if (!data) return true;
  
  // For YouTube URLs, be more aggressive about refreshing
  if (data.isYouTube) {
    // If no description or very short description, consider it weak
    const hasWeakDescription = !data.description || data.description.length < 100;
    const hasGenericTitle = data.title?.toLowerCase().includes('youtube') || false;
    const isOld = data.lastUpdated && (Date.now() - data.lastUpdated > 24 * 60 * 60 * 1000); // 24 hours
    
    return hasWeakDescription || hasGenericTitle || isOld || false;
  }
  
  // For non-YouTube URLs, use original logic
  const genericTitle = data.title?.toLowerCase().startsWith("page from ") ?? false;
  const genericDescription = isGenericDescription(data.description);
  const googleFavicon = data.favicon?.includes("google.com/s2/favicons") ?? false;
  const missingCore = !data.title && !data.description && !data.image;
  
  return genericTitle || genericDescription || googleFavicon || missingCore;
}

// Enhanced function to detect and filter generic descriptions
function isGenericDescription(desc?: string): boolean {
  if (!desc) return true;
  
  const genericPatterns = [
    /enjoy (the|this) (video|content)/i,
    /watch (now|video|this)/i,
    /check out (this|the|my)/i,
    /click (here|now)/i,
    /^video$/i,
    /^page$/i,
    /^website$/i,
    /^view (more|content)$/i,
    /^see (more|details)$/i,
    /shared (link|content)/i,
    /default (description|title)/i,
    /^[\W\s]*$/, // Only special characters or whitespace
    // YouTube-specific generic patterns
    /enjoy the videos and music you love/i,
    /upload original content/i,
    /share it all with friends/i,
    /created using youtube/i,
    /this video is unavailable/i,
    /video unavailable/i,
    /private video/i,
    /deleted video/i,
    /watch this video on youtube/i,
    /subscribe to our channel/i,
    /like and subscribe/i,
    /don't forget to subscribe/i,
    /hit the bell/i,
    /notification bell/i,
  ];
  
  const isTooShort = desc.trim().length < 20;
  const isGeneric = genericPatterns.some(pattern => pattern.test(desc.trim()));
  
  return isTooShort || isGeneric;
}

// Update URL data with better merge logic
export async function updateUrlData(shortCode: string, partial: Partial<UrlData>): Promise<UrlData | null> {
  console.log(`[updateUrlData] Updating data for ${shortCode}`);
  
  const existing = await getUrlFromKV(shortCode);
  if (!existing) {
    console.log(`[updateUrlData] No existing data found for ${shortCode}`);
    return null;
  }
  
  // Merge with preference for longer, more descriptive content
  const merged: UrlData = {
    ...existing,
    ...partial,
    // Prefer longer title if both exist
    title: (partial.title && partial.title.length > (existing.title?.length || 0)) 
      ? partial.title 
      : existing.title || partial.title,
    // Prefer longer description if both exist
    description: (partial.description && partial.description.length > (existing.description?.length || 0))
      ? partial.description
      : existing.description || partial.description,
    // Always update image if new one provided
    image: partial.image || existing.image,
    favicon: partial.favicon || existing.favicon,
    lastUpdated: Date.now(),
  };
  
  await saveUrlToKV(shortCode, merged);
  console.log(`[updateUrlData] Successfully updated ${shortCode} with description length: ${merged.description?.length || 0}`);
  return merged;
}

// Enhanced URL normalization
function normalizeUrl(url: string): string {
  try {
    let urlToNormalize = url.trim();
    
    if (!urlToNormalize.startsWith('http://') && !urlToNormalize.startsWith('https://')) {
      urlToNormalize = 'https://' + urlToNormalize;
    }
    
    const urlObj = new URL(urlToNormalize);
    
    // Special handling for YouTube URLs
    if (urlObj.hostname.includes('youtube.com') || urlObj.hostname === 'youtu.be') {
      return normalizeYouTubeUrl(urlObj);
    }
    
    let normalized = urlObj.toString();
    
    // Remove trailing slash for consistency
    if (normalized.endsWith('/')) {
      normalized = normalized.slice(0, -1);
    }
    
    // Normalize hostname to lowercase
    const hostname = urlObj.hostname.toLowerCase();
    normalized = normalized.replace(urlObj.hostname, hostname);
    
    return normalized;
  } catch (error) {
    console.error('Error normalizing URL:', error);
    return url.trim();
  }
}

// YouTube URL normalization
function normalizeYouTubeUrl(urlObj: URL): string {
  let videoId: string | null = null;
  
  // Extract video ID from various YouTube URL formats
  if (urlObj.hostname.includes('youtube.com')) {
    // Standard watch URL
    videoId = urlObj.searchParams.get('v');
    
    // YouTube Shorts
    if (!videoId && urlObj.pathname.includes('/shorts/')) {
      videoId = urlObj.pathname.split('/shorts/')[1]?.split('?')[0];
    }
    
    // Embedded or other formats
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

export async function getOriginalUrl(shortCode: string): Promise<string | null> {
  try {
    const urlData = await getUrlFromKV(shortCode);
    return urlData ? urlData.originalUrl : null;
  } catch (error) {
    console.error('Error getting original URL:', error);
    return null;
  }
}

export async function getUrl(shortCode: string): Promise<UrlData | null> {
  return await getUrlFromKV(shortCode);
}

// Enhanced short code creation with better YouTube handling
export async function createShortCode(url: string, metadata?: Partial<UrlData>): Promise<string> {
  if (!url || typeof url !== 'string') {
    throw new Error('Invalid URL provided');
  }

  const normalizedUrl = normalizeUrl(url);
  const isYouTube = isYouTubeUrl(normalizedUrl);
  
  console.log(`[createShortCode] Creating short code for: ${normalizedUrl} (YouTube: ${isYouTube})`);

  // Check if URL already exists in KV
  try {
    const existingShortCode = await kv.get<string>(`url_to_code:${normalizedUrl}`);
    
    if (existingShortCode) {
      const existingData = await getUrlFromKV(existingShortCode);
      if (existingData) {
        console.log(`[createShortCode] Found existing short code: ${existingShortCode}`);
        
        // For YouTube URLs or weak metadata, try to refresh
        const shouldRefresh = isYouTube || isWeakMetadata(existingData);
        
        if (shouldRefresh) {
          try {
            console.log(`[createShortCode] Refreshing metadata for existing URL`);
            const freshMetadata = await fetchPageMetadata(normalizedUrl);
            
            // Only update if we got significantly better metadata
            if (freshMetadata.description && 
                (!existingData.description || freshMetadata.description.length > existingData.description.length + 50)) {
              const updated = await updateUrlData(existingShortCode, {
                ...freshMetadata,
                isYouTube
              });
              
              if (updated) {
                console.log(`[createShortCode] Successfully refreshed existing metadata`);
                return existingShortCode;
              }
            }
          } catch (refreshError) {
            console.error('Error refreshing metadata for existing URL:', refreshError);
          }
        }
        
        return existingShortCode;
      }
    }
  } catch (error) {
    console.error('Error checking existing URL:', error);
  }

  // Generate unique short code
  let shortCode: string;
  let attempts = 0;
  const maxAttempts = 10;

  do {
    shortCode = Math.random().toString(36).substring(2, 10);
    attempts++;

    if (attempts > maxAttempts) {
      throw new Error('Failed to generate unique short code');
    }
  } while (await getUrlFromKV(shortCode));

  // Fetch metadata with enhanced YouTube handling
  let enhancedMetadata = metadata || {};
  
  console.log(`[createShortCode] Fetching metadata for new URL: ${normalizedUrl}`);
  
  try {
    const fetchedMetadata = await fetchPageMetadata(normalizedUrl);
    
    // For YouTube URLs, ensure we got good metadata
    if (isYouTube && fetchedMetadata.description && fetchedMetadata.description.length < 50) {
      console.log(`[createShortCode] YouTube metadata seems weak, will try refresh later`);
    }
    
    // Merge metadata, preferring fetched over provided
    enhancedMetadata = {
      ...enhancedMetadata,
      ...fetchedMetadata,
      isYouTube
    };
    
    console.log(`[createShortCode] Metadata fetch complete. Title: ${!!enhancedMetadata.title}, Description length: ${enhancedMetadata.description?.length || 0}`);
    
  } catch (error) {
    console.error('Error fetching metadata for new URL:', error);
    enhancedMetadata = { ...enhancedMetadata, isYouTube };
  }

  // Store the data in KV
  const urlData: UrlData = {
    originalUrl: normalizedUrl,
    title: enhancedMetadata?.title,
    description: enhancedMetadata?.description,
    image: enhancedMetadata?.image,
    favicon: enhancedMetadata?.favicon,
    isYouTube,
    lastUpdated: Date.now()
  };
  
  await saveUrlToKV(shortCode, urlData);
  await kv.set(`url_to_code:${normalizedUrl}`, shortCode);

  console.log(`[createShortCode] Successfully created short code: ${shortCode}`);
  return shortCode;
}

// Enhanced refresh function for existing URLs
export async function refreshUrlMetadata(shortCode: string, force: boolean = false): Promise<UrlData | null> {
  const existing = await getUrlFromKV(shortCode);
  if (!existing) return null;
  
  const shouldRefresh = force || 
    isWeakMetadata(existing) || 
    (existing.isYouTube && (!existing.description || existing.description.length < 100));
  
  if (!shouldRefresh) return existing;
  
  try {
    console.log(`[refreshUrlMetadata] Refreshing metadata for ${shortCode}`);
    const freshMetadata = await fetchPageMetadata(existing.originalUrl);
    
    if (freshMetadata.title || freshMetadata.description) {
      return await updateUrlData(shortCode, freshMetadata);
    }
  } catch (error) {
    console.error('Error refreshing metadata:', error);
  }
  
  return existing;
}

export async function getAllUrls(): Promise<Record<string, string>> {
  console.warn("getAllUrls is not fully implemented for Vercel KV and may not return all URLs.");
  
  try {
    const keys = await kv.keys('url:*');
    const urls: Record<string, string> = {};
    
    for (const key of keys) {
      const shortCode = key.split(':')[1];
      if (shortCode) {
        const urlData = await getUrlFromKV(shortCode);
        if (urlData) {
          urls[shortCode] = urlData.originalUrl;
        }
      }
    }
    
    return urls;
  } catch (error) {
    console.error('Error getting all URLs:', error);
    return {};
  }
}