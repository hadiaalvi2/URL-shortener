import { kv } from "@vercel/kv"
import { fetchPageMetadata } from "@/lib/utils"

export interface UrlData {
  originalUrl: string
  title?: string
  description?: string
  image?: string
  favicon?: string
  lastFetched?: number // Add timestamp to track when metadata was last fetched
}

// More aggressive weak metadata detection
export function isWeakMetadata(data?: Partial<UrlData> | null): boolean {
  if (!data) return true;
  
  // Check if metadata is old (more than 24 hours)
  if (data.lastFetched && Date.now() - data.lastFetched > 24 * 60 * 60 * 1000) {
    console.log('[isWeakMetadata] Metadata is old, marking as weak');
    return true;
  }
  
  const hasGenericTitle = !data.title || 
                         data.title.includes('YouTube') || 
                         data.title.includes('Video') ||
                         data.title.length < 5 ||
                         // Check if title looks like just a domain name
                         /^[A-Z][a-z]+( [A-Z][a-z]+)*$/.test(data.title);
  
  const hasGenericDescription = !data.description || 
                               data.description.includes('Enjoy the videos and music') ||
                               data.description.includes('Upload original content') ||
                               data.description.includes('Music video by') ||
                               data.description.startsWith('Visit ') ||
                               data.description.length < 20;
  
  const hasNoImage = !data.image || 
                     data.image.includes('google.com/s2/favicons') ||
                     data.image === '';
  
  // If we have at least 2 out of 3 good metadata pieces, consider it strong
  const goodMetadataCount = [!hasGenericTitle, !hasGenericDescription, !hasNoImage].filter(Boolean).length;
  
  console.log(`[isWeakMetadata] Evaluation:`, {
    hasGenericTitle,
    hasGenericDescription, 
    hasNoImage,
    goodMetadataCount,
    isWeak: goodMetadataCount < 2
  });
  
  return goodMetadataCount < 2;
}

export async function updateUrlData(shortCode: string, partial: Partial<UrlData>): Promise<UrlData | null> {
  try {
    const existing = await getUrlFromKV(shortCode);
    if (!existing) {
      console.warn(`[updateUrlData] No existing data found for shortCode: ${shortCode}`);
      return null;
    }

    // Merge with existing data, preferring new data when it's better
    const merged: UrlData = {
      originalUrl: existing.originalUrl,
      title: (partial.title && partial.title.length > 5) ? partial.title : existing.title,
      description: (partial.description && partial.description.length > 20 && !partial.description.startsWith('Visit ')) 
        ? partial.description : existing.description,
      image: (partial.image && !partial.image.includes('google.com/s2/favicons')) 
        ? partial.image : existing.image,
      favicon: partial.favicon ? partial.favicon : existing.favicon,
      lastFetched: Date.now()
    };

    await saveUrlToKV(shortCode, merged);
    console.log(`[updateUrlData] Successfully updated metadata for ${shortCode}`);
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
    console.log(`[saveUrlToKV] Successfully saved data for ${shortCode}`);
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

  console.log(`[createShortCode] Creating short code for: ${url}`);

  const normalizedUrl = normalizeUrl(url);
  console.log(`[createShortCode] Normalized URL: ${normalizedUrl}`);

  // Check if URL already exists
  try {
    const existingShortCode = await kv.get<string>(`url_to_code:${normalizedUrl}`);

    if (existingShortCode) {
      console.log(`[createShortCode] Found existing short code: ${existingShortCode}`);
      const existingData = await getUrlFromKV(existingShortCode);
      if (existingData) {
        // Always try to refresh metadata if it's weak or old
        if (isWeakMetadata(existingData)) {
          console.log(`[createShortCode] Existing metadata is weak, refreshing...`);
          try {
            const freshMetadata = await fetchPageMetadata(normalizedUrl);
            const updatedData = await updateUrlData(existingShortCode, freshMetadata);
            if (updatedData) {
              return existingShortCode;
            }
          } catch (error) {
            console.warn(`[createShortCode] Failed to refresh metadata, using existing:`, error);
          }
        }
        return existingShortCode;
      } else {
        await kv.del(`url_to_code:${normalizedUrl}`);
      }
    }
  } catch (error) {
    console.error(`[createShortCode] Error checking existing URL:`, error);
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

  console.log(`[createShortCode] Generated unique short code: ${shortCode}`);

  // Always try to fetch fresh metadata
  let enhancedMetadata: Partial<UrlData> = {};
  
  try {
    console.log(`[createShortCode] Fetching fresh metadata for: ${normalizedUrl}`);
    enhancedMetadata = await fetchPageMetadata(normalizedUrl);
    
    console.log(`[createShortCode] Fetched metadata:`, {
      title: enhancedMetadata.title ? `${enhancedMetadata.title.substring(0, 50)}...` : 'none',
      description: enhancedMetadata.description ? `${enhancedMetadata.description.substring(0, 50)}...` : 'none',
      hasImage: !!enhancedMetadata.image,
      hasFavicon: !!enhancedMetadata.favicon,
    });
  } catch (error) {
    console.error(`[createShortCode] Error fetching metadata, using fallback:`, error);
    // Create better fallback metadata
    try {
      const urlObj = new URL(normalizedUrl);
      const domain = urlObj.hostname.replace('www.', '');
      const domainTitle = domain.split('.').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      
      enhancedMetadata = {
        title: domainTitle,
        description: `Visit ${domain} to see the content`,
        image: '',
        favicon: `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=128`
      };
    } catch {
      enhancedMetadata = {
        title: 'Shared Link',
        description: '',
        image: '',
        favicon: '/favicon.ico'
      };
    }
  }

  // Ensure we have at least basic metadata
  const urlData: UrlData = {
    originalUrl: normalizedUrl,
    title: enhancedMetadata.title || extractDomainTitle(normalizedUrl),
    description: enhancedMetadata.description || "",
    image: enhancedMetadata.image || "",
    favicon: enhancedMetadata.favicon || getDefaultFavicon(normalizedUrl),
    lastFetched: Date.now()
  }
  
  console.log(`[createShortCode] Final URL data:`, {
    originalUrl: urlData.originalUrl,
    title: urlData.title,
    description: urlData.description ? `${urlData.description.substring(0, 50)}...` : 'none',
    hasImage: !!urlData.image,
    hasFavicon: !!urlData.favicon,
  });

  // Store the data in KV
  try {
    await saveUrlToKV(shortCode, urlData);
    await kv.set(`url_to_code:${normalizedUrl}`, shortCode);
    console.log(`[createShortCode] Successfully created short code: ${shortCode}`);
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
    
    // Normalize hostname to lowercase
    urlObj.hostname = urlObj.hostname.toLowerCase();
    
    // Handle common redirects
    if (urlObj.hostname === 'youtu.be') {
      const videoId = urlObj.pathname.slice(1).split('?')[0];
      return `https://www.youtube.com/watch?v=${videoId}`;
    }
    
    let normalized = urlObj.toString();
    
    // Remove trailing slash for consistency
    if (normalized.endsWith('/') && urlObj.pathname === '/') {
      normalized = normalized.slice(0, -1);
    }
    
    console.log(`[normalizeUrl] ${url} -> ${normalized}`);
    
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

// Helper functions
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