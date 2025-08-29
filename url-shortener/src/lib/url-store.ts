import { kv } from "@vercel/kv"
import { fetchPageMetadata } from "@/lib/utils"

export interface UrlData {
  originalUrl: string
  title?: string
  description?: string
  image?: string
  favicon?: string
  createdAt?: number
  lastUpdated?: number
}

// Enhanced function to detect weak/generic metadata
export function isWeakMetadata(data?: Partial<UrlData> | null): boolean {
  if (!data) return true;
  
  const weakTitleIndicators = [
    !data.title,
    data.title && data.title.length < 3,
    data.title && data.title.toLowerCase().includes('youtube'),
    data.title && data.title.toLowerCase().includes('video'),
    data.title && data.title.toLowerCase().includes('website'),
    data.title && data.title.toLowerCase().includes('error'),
    data.title && data.title.toLowerCase().includes('not found'),
    data.title && data.title === extractDomainTitle(data.originalUrl || ''),
  ];

  const weakDescriptionIndicators = [
    !data.description,
    data.description && data.description.length < 10,
    data.description && data.description.includes('Enjoy the videos and music'),
    data.description && data.description.includes('Upload original content'),
    data.description && data.description.includes('Music video by'),
    data.description && data.description.toLowerCase().includes('visit'),
  ];

  const weakImageIndicators = [
    !data.image,
    data.image && data.image.includes('google.com/s2/favicons'),
    data.image && data.image.includes('default'),
  ];

  const hasWeakTitle = weakTitleIndicators.some(indicator => indicator);
  const hasWeakDescription = weakDescriptionIndicators.some(indicator => indicator);
  const hasWeakImage = weakImageIndicators.some(indicator => indicator);

  // Consider metadata weak if 2 or more aspects are weak
  const weakCount = [hasWeakTitle, hasWeakDescription, hasWeakImage].filter(Boolean).length;
  
  console.log(`[isWeakMetadata] Weakness indicators:`, {
    title: data.title,
    hasWeakTitle,
    hasWeakDescription,
    hasWeakImage,
    weakCount,
    isWeak: weakCount >= 2
  });

  return weakCount >= 2;
}

export async function updateUrlData(shortCode: string, partial: Partial<UrlData>): Promise<UrlData | null> {
  try {
    const existing = await getUrlFromKV(shortCode);
    if (!existing) {
      console.warn(`[updateUrlData] No existing data found for shortCode: ${shortCode}`);
      return null;
    }

    // Smart merging - only update if new data is genuinely better
    const merged: UrlData = {
      originalUrl: existing.originalUrl,
      title: chooseBetterValue(existing.title, partial.title, 'title'),
      description: chooseBetterValue(existing.description, partial.description, 'description'),
      image: chooseBetterValue(existing.image, partial.image, 'image'),
      favicon: chooseBetterValue(existing.favicon, partial.favicon, 'favicon'),
      createdAt: existing.createdAt || Date.now(),
      lastUpdated: Date.now(),
    };

    await saveUrlToKV(shortCode, merged);
    console.log(`[updateUrlData] Successfully updated metadata for ${shortCode}`);
    return merged;
  } catch (error) {
    console.error(`[updateUrlData] Error updating URL data for ${shortCode}:`, error);
    return null;
  }
}

function chooseBetterValue(existing: string | undefined, newValue: string | undefined, type: string): string | undefined {
  if (!existing && !newValue) return undefined;
  if (!existing) return newValue;
  if (!newValue) return existing;

  // Type-specific quality checks
  switch (type) {
    case 'title':
      // Prefer longer, more descriptive titles
      if (newValue.length > existing.length && newValue.length > 5) return newValue;
      if (existing.toLowerCase().includes('youtube') && !newValue.toLowerCase().includes('youtube') && newValue.length > 5) return newValue;
      if (existing.toLowerCase().includes('website') && newValue.length > 5) return newValue;
      break;
      
    case 'description':
      // Prefer longer, more specific descriptions
      if (newValue.length > existing.length && newValue.length > 20) return newValue;
      if (existing.includes('Enjoy the videos') && !newValue.includes('Enjoy the videos')) return newValue;
      if (existing.toLowerCase().includes('visit') && newValue.length > 10) return newValue;
      break;
      
    case 'image':
      // Prefer non-favicon images
      if (!existing.includes('favicons') && newValue.includes('favicons')) return existing;
      if (existing.includes('favicons') && !newValue.includes('favicons')) return newValue;
      if (newValue.includes('maxresdefault') && !existing.includes('maxresdefault')) return newValue;
      break;
      
    case 'favicon':
      // Prefer specific favicons over generic ones
      if (existing.includes('favicons') && !newValue.includes('favicons')) return newValue;
      break;
  }

  return existing; // Keep existing if no clear improvement
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
    const dataToSave = {
      ...data,
      lastUpdated: Date.now(),
    };
    await kv.set(`url:${shortCode}`, dataToSave);
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
        // Check if we should refresh the metadata
        const shouldRefresh = isWeakMetadata(existingData) || 
                            (!existingData.lastUpdated || 
                             Date.now() - existingData.lastUpdated > 24 * 60 * 60 * 1000); // 24 hours

        if (shouldRefresh) {
          console.log(`[createShortCode] Refreshing metadata for existing URL`);
          try {
            const freshMetadata = await fetchPageMetadata(normalizedUrl);
            if (freshMetadata.title && freshMetadata.title !== extractDomainTitle(normalizedUrl)) {
              await updateUrlData(existingShortCode, freshMetadata);
              const updatedData = await getUrlFromKV(existingShortCode);
              console.log(`[createShortCode] Metadata refreshed for existing short code: ${existingShortCode}`)
              return existingShortCode;
            }
          } catch (refreshError) {
            console.warn(`[createShortCode] Failed to refresh metadata:`, refreshError);
          }
        }
        
        console.log(`[createShortCode] Reusing existing short code: ${existingShortCode}`);
        return existingShortCode;
      } else {
        console.warn(`[createShortCode] Orphaned URL mapping found, will create new short code`);
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

  // Enhanced metadata fetching with multiple attempts
  let enhancedMetadata = metadata || {};
  
  console.log(`[createShortCode] Fetching enhanced metadata for: ${normalizedUrl}`);
  try {
    const fetchedMetadata = await Promise.race([
      fetchPageMetadata(normalizedUrl),
      new Promise<null>((_, reject) => 
        setTimeout(() => reject(new Error('Metadata fetch timeout')), 30000)
      )
    ]);
    
    if (fetchedMetadata) {
      enhancedMetadata = {
        title: chooseBetterValue(enhancedMetadata.title, fetchedMetadata.title, 'title') || fetchedMetadata.title,
        description: chooseBetterValue(enhancedMetadata.description, fetchedMetadata.description, 'description') || fetchedMetadata.description,
        image: chooseBetterValue(enhancedMetadata.image, fetchedMetadata.image, 'image') || fetchedMetadata.image,
        favicon: chooseBetterValue(enhancedMetadata.favicon, fetchedMetadata.favicon, 'favicon') || fetchedMetadata.favicon,
      };
      
      console.log(`[createShortCode] Enhanced metadata:`, {
        title: enhancedMetadata.title ? `${enhancedMetadata.title.substring(0, 50)}...` : 'none',
        description: enhancedMetadata.description ? `${enhancedMetadata.description.substring(0, 50)}...` : 'none',
        hasImage: !!enhancedMetadata.image,
        hasFavicon: !!enhancedMetadata.favicon,
      });
    }
  } catch (error) {
    console.warn(`[createShortCode] Enhanced metadata fetch failed:`, error);
    // Create fallback metadata
    try {
      const urlObj = new URL(normalizedUrl);
      const domain = urlObj.hostname.replace('www.', '');
      enhancedMetadata = {
        title: enhancedMetadata.title || domain.split('.').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
        description: enhancedMetadata.description || `Visit ${domain}`,
        image: enhancedMetadata.image || "",
        favicon: enhancedMetadata.favicon || `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=128`
      };
    } catch {
      enhancedMetadata = {
        title: "Website",
        description: "",
        image: "",
        favicon: "/favicon.ico"
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
    createdAt: Date.now(),
    lastUpdated: Date.now(),
  }
  
  console.log(`[createShortCode] Final URL data:`, {
    originalUrl: urlData.originalUrl,
    title: urlData.title,
    description: urlData.description ? `${urlData.description.substring(0, 50)}...` : 'none',
    hasImage: !!urlData.image,
    hasFavicon: !!urlData.favicon,
  });

  // Store the data with error handling
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