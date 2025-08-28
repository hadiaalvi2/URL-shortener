import { kv } from "@vercel/kv"
import { fetchPageMetadata } from "@/lib/utils"

export interface UrlData {
  originalUrl: string
  title?: string
  description?: string
  image?: string
  favicon?: string
}

export interface UrlStorage {
  codeToUrl: Record<string, UrlData>
  urlToCode: Record<string, string>
}

// Vercel KV functions
export async function getUrlFromKV(shortCode: string): Promise<UrlData | null> {
  console.log(`Attempting to get URL data for short code: ${shortCode}`);
  const data = await kv.get<UrlData>(`url:${shortCode}`);
  console.log(`Data for ${shortCode}:`, data);
  return data;
}

export async function saveUrlToKV(shortCode: string, data: UrlData) {
  await kv.set(`url:${shortCode}`, data)
}

// Enhanced function to detect generic metadata with YouTube-specific patterns
export function isWeakMetadata(data?: Partial<UrlData> | null): boolean {
  if (!data) return true;
  
  const genericTitle = data.title?.toLowerCase().startsWith("page from ") ?? false;
  const genericDescription = isGenericDescription(data.description);
  const googleFavicon = data.favicon?.includes("google.com/s2/favicons") ?? false;
  const missingCore = !data.title && !data.description && !data.image;
  
  return genericTitle || genericDescription || googleFavicon || missingCore;
}

// Enhanced function to detect and filter generic descriptions including YouTube patterns
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
    // Enhanced YouTube-specific generic patterns
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
  ];
  
  const isTooShort = desc.trim().length < 20; // Increased minimum length for better quality
  const isGeneric = genericPatterns.some(pattern => pattern.test(desc.trim()));
  
  return isTooShort || isGeneric;
}

export async function updateUrlData(shortCode: string, partial: Partial<UrlData>): Promise<UrlData | null> {
  const existing = await getUrlFromKV(shortCode);
  if (!existing) return null;
  const merged: UrlData = {
    ...existing,
    ...partial,
  };
  await saveUrlToKV(shortCode, merged);
  return merged;
}

function normalizeUrl(url: string): string {
  try {
    let urlToNormalize = url;
    
    if (!urlToNormalize.startsWith('http://') && !urlToNormalize.startsWith('https://')) {
      urlToNormalize = 'https://' + urlToNormalize;
    }
    
    const urlObj = new URL(urlToNormalize);
    
    let normalized = urlObj.toString();
    
    if (normalized.endsWith('/')) {
      normalized = normalized.slice(0, -1);
    }
    
    const hostname = urlObj.hostname.toLowerCase();
    normalized = normalized.replace(urlObj.hostname, hostname);
    
    return normalized;
  } catch (error) {
    console.error('Error normalizing URL:', error);
    return url.trim();
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

export async function createShortCode(url: string, metadata?: Partial<UrlData>): Promise<string> {
  if (!url || typeof url !== 'string') {
    throw new Error('Invalid URL provided');
  }

  const normalizedUrl = normalizeUrl(url);

  // Check if URL already exists in KV using a direct lookup
  const existingShortCode = await kv.get<string>(`url_to_code:${normalizedUrl}`);

  if (existingShortCode) {
    // Verify the short code still exists in KV
    const existingData = await getUrlFromKV(existingShortCode);
    if (existingData) {
      // For YouTube URLs, always try to refresh if metadata is weak
      const urlObj = new URL(normalizedUrl);
      const isYouTube = urlObj.hostname.includes('youtube.com') || urlObj.hostname === 'youtu.be';
      
      if (isYouTube && (isWeakMetadata(existingData) || !existingData.description)) {
        try {
          console.log(`[createShortCode] Refreshing YouTube metadata for existing URL`);
          const freshMetadata = await fetchPageMetadata(normalizedUrl); // This will use fetchYouTubeMetadata
          if (freshMetadata.description || freshMetadata.title) {
            const updated = await updateUrlData(existingShortCode, freshMetadata);
            if (updated) {
              console.log(`[createShortCode] Successfully updated existing YouTube metadata`);
              return existingShortCode;
            }
          }
        } catch (error) {
          console.error('Error refreshing YouTube metadata:', error);
        }
      }
      
      return existingShortCode;
    }
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
  } while (await getUrlFromKV(shortCode)); // Check uniqueness against KV

  // Enhanced metadata extraction with better YouTube handling
  let enhancedMetadata = metadata || {};
  
  // If metadata is weak or missing, try to fetch better metadata
  if (isWeakMetadata(metadata)) {
    try {
      console.log(`Fetching enhanced metadata for: ${url}`);
      const fetchedMetadata = await fetchPageMetadata(url);
      
      // Filter out generic descriptions
      if (fetchedMetadata.description && isGenericDescription(fetchedMetadata.description)) {
        fetchedMetadata.description = undefined;
      }
      
      // Filter out generic titles
      if (fetchedMetadata.title && isGenericDescription(fetchedMetadata.title)) {
        fetchedMetadata.title = undefined;
      }
      
      enhancedMetadata = { ...enhancedMetadata, ...fetchedMetadata };
    } catch (error) {
      console.error('Error fetching enhanced metadata:', error);
    }
  }

  // Store the data in KV
  const urlData: UrlData = {
    originalUrl: url,
    title: enhancedMetadata?.title,
    description: enhancedMetadata?.description,
    image: enhancedMetadata?.image,
    favicon: enhancedMetadata?.favicon,
  }
  
  await saveUrlToKV(shortCode, urlData);
  await kv.set(`url_to_code:${normalizedUrl}`, shortCode); // Store reverse mapping for efficient lookup

  return shortCode;
}

export async function getAllUrls(): Promise<Record<string, string>> {
  console.warn("getAllUrls is not fully implemented for Vercel KV and may not return all URLs.");
  const keys = await kv.keys('url:*'); // Get all keys that start with 'url:'
  const urls: Record<string, string> = {};
  for (const key of keys) {
    const shortCode = key.split(':')[1];
    const urlData = await getUrlFromKV(shortCode);
    if (urlData) {
      urls[shortCode] = urlData.originalUrl;
    }
  }
  return urls;
}