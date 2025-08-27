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

// Vercel KV functions with better error handling
export async function getUrlFromKV(shortCode: string): Promise<UrlData | null> {
  try {
    console.log(`Getting URL data for: ${shortCode}`);
    const data = await kv.get<UrlData>(`url:${shortCode}`);
    return data;
  } catch (error) {
    console.error(`Error getting URL from KV for ${shortCode}:`, error);
    return null;
  }
}

export async function saveUrlToKV(shortCode: string, data: UrlData): Promise<void> {
  try {
    await kv.set(`url:${shortCode}`, data);
    console.log(`Saved URL data for: ${shortCode}`);
  } catch (error) {
    console.error(`Error saving URL to KV for ${shortCode}:`, error);
    throw error;
  }
}

// Simplified weak metadata detection
export function isWeakMetadata(data?: Partial<UrlData> | null): boolean {
  if (!data) return true;
  
  const hasWeakTitle = !data.title || 
                      data.title.toLowerCase().startsWith("page from ") ||
                      data.title.trim().length < 3;
  
  const hasWeakDescription = !data.description || 
                            data.description.trim().length < 20;
  
  return hasWeakTitle && hasWeakDescription;
}

export async function updateUrlData(shortCode: string, partial: Partial<UrlData>): Promise<UrlData | null> {
  try {
    const existing = await getUrlFromKV(shortCode);
    if (!existing) return null;
    
    const merged: UrlData = { ...existing, ...partial };
    await saveUrlToKV(shortCode, merged);
    return merged;
  } catch (error) {
    console.error(`Error updating URL data for ${shortCode}:`, error);
    return null;
  }
}

// Simplified URL normalization
function normalizeUrl(url: string): string {
  try {
    let normalizedUrl = url.trim();
    
    // Add protocol if missing
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      normalizedUrl = 'https://' + normalizedUrl;
    }
    
    const urlObj = new URL(normalizedUrl);
    
    // Remove trailing slash
    let result = urlObj.toString();
    if (result.endsWith('/') && urlObj.pathname === '/') {
      result = result.slice(0, -1);
    }
    
    return result;
  } catch (error) {
    console.error('URL normalization error:', error);
    throw new Error('Invalid URL format');
  }
}

// Improved URL validation
export function isValidUrl(url: string): boolean {
  try {
    const testUrl = url.startsWith('http') ? url : `https://${url}`;
    const urlObj = new URL(testUrl);
    return ['http:', 'https:'].includes(urlObj.protocol) && 
           urlObj.hostname.includes('.') && 
           urlObj.hostname.length > 3;
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

// Simplified short code generation
function generateShortCode(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export async function createShortCode(url: string, metadata?: Partial<UrlData>): Promise<string> {
  if (!url || typeof url !== 'string') {
    throw new Error('URL is required');
  }

  if (!isValidUrl(url)) {
    throw new Error('Invalid URL format');
  }

  let normalizedUrl: string;
  try {
    normalizedUrl = normalizeUrl(url);
  } catch (error) {
    throw new Error('Failed to normalize URL');
  }

  // Check for existing URL
  try {
    const existingShortCode = await kv.get<string>(`url_to_code:${normalizedUrl}`);
    if (existingShortCode) {
      const existingData = await getUrlFromKV(existingShortCode);
      if (existingData) {
        console.log(`Found existing short code: ${existingShortCode}`);
        return existingShortCode;
      }
    }
  } catch (error) {
    console.warn('Error checking existing URL:', error);
  }

  // Generate unique short code
  let shortCode: string;
  let attempts = 0;
  const maxAttempts = 10;

  do {
    shortCode = generateShortCode();
    attempts++;

    if (attempts > maxAttempts) {
      throw new Error('Failed to generate unique short code');
    }
  } while (await getUrlFromKV(shortCode));

  // Prepare metadata with fallbacks
  let finalMetadata = metadata || {};

  // Only fetch metadata if we don't have good metadata already
  if (isWeakMetadata(finalMetadata)) {
    try {
      console.log(`Fetching metadata for: ${normalizedUrl}`);
      const fetchedMetadata = await fetchPageMetadata(normalizedUrl);
      finalMetadata = { ...finalMetadata, ...fetchedMetadata };
    } catch (error) {
      console.warn('Metadata fetch failed, using URL-based fallback:', error);
      // Create fallback metadata from URL
      try {
        const urlObj = new URL(normalizedUrl);
        finalMetadata = {
          title: `${urlObj.hostname}`,
          description: `Link to ${urlObj.hostname}`,
          favicon: `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=128`,
          ...finalMetadata
        };
      } catch {
        finalMetadata = {
          title: 'Shortened Link',
          description: 'Click to visit the original link',
          ...finalMetadata
        };
      }
    }
  }

  // Save the data
  const urlData: UrlData = {
    originalUrl: normalizedUrl,
    title: finalMetadata.title,
    description: finalMetadata.description,
    image: finalMetadata.image,
    favicon: finalMetadata.favicon,
  };

  try {
    await saveUrlToKV(shortCode, urlData);
    await kv.set(`url_to_code:${normalizedUrl}`, shortCode);
    console.log(`Created short code: ${shortCode} for ${normalizedUrl}`);
  } catch (error) {
    console.error('Error saving URL data:', error);
    throw new Error('Failed to save shortened URL');
  }

  return shortCode;
}

export async function getAllUrls(): Promise<Record<string, string>> {
  try {
    const keys = await kv.keys('url:*');
    const urls: Record<string, string> = {};
    
    for (const key of keys) {
      const shortCode = key.split(':')[1];
      const urlData = await getUrlFromKV(shortCode);
      if (urlData) {
        urls[shortCode] = urlData.originalUrl;
      }
    }
    
    return urls;
  } catch (error) {
    console.error('Error getting all URLs:', error);
    return {};
  }
}