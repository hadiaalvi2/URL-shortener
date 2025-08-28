import { kv } from "@vercel/kv"
import { fetchPageMetadata } from "@/lib/utils"

export interface UrlData {
  originalUrl: string
  title?: string
  description?: string
  image?: string
  favicon?: string
}

// Enhanced function to detect generic metadata
export function isWeakMetadata(data?: Partial<UrlData> | null): boolean {
  if (!data) return true;
  
  const hasGenericTitle = !data.title || 
                         data.title.includes('YouTube') || 
                         data.title.includes('Video');
  
  const hasGenericDescription = !data.description || 
                               data.description.includes('Enjoy the videos and music') ||
                               data.description.includes('Upload original content') ||
                               data.description.includes('Music video by');
  
  return hasGenericTitle || hasGenericDescription;
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

export async function getUrlFromKV(shortCode: string): Promise<UrlData | null> {
  const data = await kv.get<UrlData>(`url:${shortCode}`);
  return data;
}

export async function saveUrlToKV(shortCode: string, data: UrlData) {
  await kv.set(`url:${shortCode}`, data)
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
  } while (await getUrlFromKV(shortCode));

  // Use the provided metadata (which should already be fetched from the route)
  // Only fetch fresh metadata if none was provided
  let enhancedMetadata = metadata || {};
  
  if (Object.keys(enhancedMetadata).length === 0) {
    try {
      console.log(`[createShortCode] Fetching metadata for: ${url}`);
      const fetchedMetadata = await fetchPageMetadata(url);
      enhancedMetadata = { ...enhancedMetadata, ...fetchedMetadata };
    } catch (error) {
      console.error('Error fetching enhanced metadata:', error);
      // Fallback to domain-based metadata
      enhancedMetadata = {
        title: extractDomainTitle(url),
        favicon: getDefaultFavicon(url)
      };
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
  await kv.set(`url_to_code:${normalizedUrl}`, shortCode);

  return shortCode;
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

// Add these helper functions at the bottom of the file
function extractDomainTitle(url: string): string {
  try {
    const domain = new URL(url).hostname;
    return domain.replace('www.', '').replace(/\.[^.]+$/, '')
      .split('.').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join(' ');
  } catch {
    return "Untitled";
  }
}

function getDefaultFavicon(url: string): string {
  try {
    const urlObj = new URL(url);
    return `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=128`;
  } catch {
    return "/favicon.ico";
  }
}