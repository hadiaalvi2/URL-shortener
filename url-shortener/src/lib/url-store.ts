import { kv } from "@vercel/kv"
import { fetchPageMetadata } from "@/lib/utils"

export interface UrlData {
  originalUrl: string
  title?: string
  description?: string
  image?: string
  favicon?: string
  lastFetched?: number
}

// More lenient weak metadata detection for faster processing
export function isWeakMetadata(data?: Partial<UrlData> | null): boolean {
  if (!data) return true;
  
  // Check if metadata is old (more than 7 days instead of 1 day for less frequent refreshes)
  if (data.lastFetched && Date.now() - data.lastFetched > 7 * 24 * 60 * 60 * 1000) {
    console.log('[isWeakMetadata] Metadata is old (>7 days), marking as weak');
    return true;
  }
  
  // More lenient criteria for performance
  const hasReasonableTitle = data.title && data.title.length > 3;
  const hasReasonableDescription = data.description && data.description.length > 10;
  const hasImage = data.image && !data.image.includes('google.com/s2/favicons');
  
  // Accept if we have at least title OR (description + image)
  const isAcceptable = hasReasonableTitle || (hasReasonableDescription && hasImage);
  
  console.log(`[isWeakMetadata] Quick evaluation:`, {
    hasReasonableTitle,
    hasReasonableDescription,
    hasImage,
    isWeak: !isAcceptable
  });
  
  return !isAcceptable;
}

export async function updateUrlData(shortCode: string, partial: Partial<UrlData>): Promise<UrlData | null> {
  try {
    const existing = await getUrlFromKV(shortCode);
    if (!existing) {
      console.warn(`[updateUrlData] No existing data found for shortCode: ${shortCode}`);
      return null;
    }

    // Quick merge with preference for new data
    const merged: UrlData = {
      originalUrl: existing.originalUrl,
      title: partial.title || existing.title,
      description: partial.description || existing.description,
      image: partial.image || existing.image,
      favicon: partial.favicon || existing.favicon,
      lastFetched: Date.now()
    };

    await saveUrlToKV(shortCode, merged);
    console.log(`[updateUrlData] Quick update completed for ${shortCode}`);
    return merged;
  } catch (error) {
    console.error(`[updateUrlData] Error updating URL data for ${shortCode}:`, error);
    return null;
  }
}

export async function getUrlFromKV(shortCode: string): Promise<UrlData | null> {
  try {
    const data = await kv.get<UrlData>(`url:${shortCode}`);
    return data;
  } catch (error) {
    console.error(`[getUrlFromKV] Error retrieving URL data for ${shortCode}:`, error);
    return null;
  }
}

export async function saveUrlToKV(shortCode: string, data: UrlData) {
  try {
    await kv.set(`url:${shortCode}`, data);
    console.log(`[saveUrlToKV] Quick save completed for ${shortCode}`);
  } catch (error) {
    console.error(`[saveUrlToKV] Error saving URL data for ${shortCode}:`, error);
    throw error;
  }
}

export async function getUrl(shortCode: string): Promise<UrlData | null> {
  return await getUrlFromKV(shortCode);
}

export async function createShortCode(url: string, metadata?: Partial<UrlData>): Promise<string> {
  if (!url || typeof url !== 'string') {
    throw new Error('Invalid URL provided');
  }

  console.log(`[createShortCode] Quick creation for: ${url}`);

  const normalizedUrl = normalizeUrl(url);

  // Quick check for existing URL
  try {
    const existingShortCode = await kv.get<string>(`url_to_code:${normalizedUrl}`);
    if (existingShortCode) {
      const existingData = await getUrlFromKV(existingShortCode);
      if (existingData) {
        console.log(`[createShortCode] Found existing short code: ${existingShortCode}`);
        return existingShortCode;
      } else {
        await kv.del(`url_to_code:${normalizedUrl}`);
      }
    }
  } catch (error) {
    console.error(`[createShortCode] Error checking existing URL:`, error);
  }

  // Generate unique short code quickly
  let shortCode: string;
  let attempts = 0;
  const maxAttempts = 5; // Reduced attempts

  do {
    shortCode = Math.random().toString(36).substring(2, 10);
    attempts++;

    if (attempts > maxAttempts) {
      throw new Error('Failed to generate unique short code quickly');
    }
  } while (await getUrlFromKV(shortCode));

  console.log(`[createShortCode] Generated unique short code: ${shortCode}`);

  // Use provided metadata or create minimal fallback
  let urlMetadata = metadata || {};
  
  if (!urlMetadata.title && !urlMetadata.description) {
    // Quick fallback generation
    try {
      const urlObj = new URL(normalizedUrl);
      const domain = urlObj.hostname.replace('www.', '');
      const domainTitle = domain.split('.').map(w => 
        w.charAt(0).toUpperCase() + w.slice(1)
      ).join(' ');
      
      urlMetadata = {
        title: domainTitle,
        description: `Visit ${domain}`,
        image: '',
        favicon: `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=128`
      };
    } catch {
      urlMetadata = {
        title: 'Shared Link',
        description: '',
        image: '',
        favicon: '/favicon.ico'
      };
    }
  }

  const urlData: UrlData = {
    originalUrl: normalizedUrl,
    title: urlMetadata.title || extractDomainTitle(normalizedUrl),
    description: urlMetadata.description || "",
    image: urlMetadata.image || "",
    favicon: urlMetadata.favicon || getDefaultFavicon(normalizedUrl),
    lastFetched: Date.now()
  }

  // Store the data quickly
  try {
    await Promise.all([
      saveUrlToKV(shortCode, urlData),
      kv.set(`url_to_code:${normalizedUrl}`, shortCode)
    ]);
    console.log(`[createShortCode] Quick storage completed: ${shortCode}`);
  } catch (error) {
    console.error(`[createShortCode] Error storing data:`, error);
    throw new Error('Failed to store URL data');
  }

  return shortCode;
}

function normalizeUrl(url: string): string {
  try {
    let urlToNormalize = url.trim();
    
    if (!urlToNormalize.startsWith('http://') && !urlToNormalize.startsWith('https://')) {
      urlToNormalize = 'https://' + urlToNormalize;
    }
    
    const urlObj = new URL(urlToNormalize);
    urlObj.hostname = urlObj.hostname.toLowerCase();
    
    // Quick youtu.be handling
    if (urlObj.hostname === 'youtu.be') {
      const videoId = urlObj.pathname.slice(1).split('?')[0];
      return `https://www.youtube.com/watch?v=${videoId}`;
    }
    
    let normalized = urlObj.toString();
    if (normalized.endsWith('/') && urlObj.pathname === '/') {
      normalized = normalized.slice(0, -1);
    }
    
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

function extractDomainTitle(url: string): string {
  try {
    const domain = new URL(url).hostname;
    return domain.replace('www.', '').replace(/\.[^.]+$/, '')
      .split('.').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join(' ');
  } catch {
    return "Website";
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