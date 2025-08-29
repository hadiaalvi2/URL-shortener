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
  socialMediaOptimized?: boolean // Track if optimized for social media
}

// Enhanced function to detect weak/generic metadata - especially important for social sharing
export function isWeakMetadata(data?: Partial<UrlData> | null): boolean {
  if (!data) return true;
  
  const weakTitleIndicators = [
    !data.title,
    data.title && data.title.length < 3,
    data.title && data.title.toLowerCase().includes('youtube') && data.title.toLowerCase().includes('video'),
    data.title && data.title.toLowerCase() === 'website',
    data.title && data.title.toLowerCase().includes('error'),
    data.title && data.title.toLowerCase().includes('not found'),
    data.title && data.title.toLowerCase().includes('untitled'),
    data.title && data.title === extractDomainTitle(data.originalUrl || ''),
  ];

  const weakDescriptionIndicators = [
    !data.description,
    data.description && data.description.length < 15,
    data.description && data.description.includes('Enjoy the videos and music'),
    data.description && data.description.includes('Upload original content'),
    data.description && data.description.toLowerCase().startsWith('visit '),
  ];

  const weakImageIndicators = [
    !data.image,
    data.image && data.image.includes('google.com/s2/favicons'),
    data.image && data.image.includes('default'),
  ];

  const hasWeakTitle = weakTitleIndicators.some(indicator => indicator);
  const hasWeakDescription = weakDescriptionIndicators.some(indicator => indicator);
  const hasWeakImage = weakImageIndicators.some(indicator => indicator);

  // For social media, we're stricter - need good title AND (description OR image)
  const isSocialMediaWeak = hasWeakTitle || (hasWeakDescription && hasWeakImage);
  
  console.log(`[isWeakMetadata] Analysis for social sharing:`, {
    title: data.title,
    hasWeakTitle,
    hasWeakDescription,
    hasWeakImage,
    isSocialMediaWeak
  });

  return isSocialMediaWeak;
}

// Special function to get/refresh data specifically for social media bots
export async function getUrlForSocialMedia(shortCode: string): Promise<UrlData | null> {
  console.log(`[getUrlForSocialMedia] Getting optimized data for social media: ${shortCode}`)
  
  const data = await getUrlFromKV(shortCode);
  if (!data) {
    console.log(`[getUrlForSocialMedia] No data found for shortCode: ${shortCode}`)
    return null;
  }

  // Check if we need to fetch fresh metadata for social media
  const needsRefresh = !data.socialMediaOptimized || 
                      isWeakMetadata(data) || 
                      (!data.lastUpdated || Date.now() - data.lastUpdated > 2 * 60 * 60 * 1000); // 2 hours

  if (needsRefresh) {
    console.log(`[getUrlForSocialMedia] Refreshing metadata for social media optimization`)
    
    try {
      const freshMetadata = await Promise.race([
        fetchPageMetadata(data.originalUrl),
        new Promise<null>((_, reject) => 
          setTimeout(() => reject(new Error('Social metadata timeout')), 30000)
        )
      ]);
      
      if (freshMetadata && (freshMetadata.title || freshMetadata.description || freshMetadata.image)) {
        console.log(`[getUrlForSocialMedia] Got fresh metadata:`, {
          title: freshMetadata.title,
          hasDescription: !!freshMetadata.description,
          hasImage: !!freshMetadata.image,
          hasFavicon: !!freshMetadata.favicon
        })
        
        // Update with social media optimized flag
        const updatedData = await updateUrlData(shortCode, {
          ...freshMetadata,
          socialMediaOptimized: true
        });
        
        if (updatedData) {
          console.log(`[getUrlForSocialMedia] Successfully updated data for social media`)
          return updatedData;
        }
      }
    } catch (error) {
      console.error(`[getUrlForSocialMedia] Error refreshing metadata:`, error)
    }
  }

  return data;
}

export async function updateUrlData(shortCode: string, partial: Partial<UrlData>): Promise<UrlData | null> {
  try {
    const existing = await getUrlFromKV(shortCode);
    if (!existing) {
      console.warn(`[updateUrlData] No existing data found for shortCode: ${shortCode}`);
      return null;
    }

    // Smart merging - prioritize better data for social media
    const merged: UrlData = {
      originalUrl: existing.originalUrl,
      title: chooseBetterValue(existing.title, partial.title, 'title'),
      description: chooseBetterValue(existing.description, partial.description, 'description'),
      image: chooseBetterValue(existing.image, partial.image, 'image'),
      favicon: chooseBetterValue(existing.favicon, partial.favicon, 'favicon'),
      createdAt: existing.createdAt || Date.now(),
      lastUpdated: Date.now(),
      socialMediaOptimized: partial.socialMediaOptimized || existing.socialMediaOptimized || false,
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

  // Enhanced quality checks for social media sharing
  switch (type) {
    case 'title':
      // Prefer specific, longer titles for social media
      if (newValue.length > existing.length && newValue.length > 10) return newValue;
      if (existing.toLowerCase().includes('youtube') && existing.toLowerCase().includes('video') && 
          !newValue.toLowerCase().includes('video') && newValue.length > 5) return newValue;
      if (existing.toLowerCase() === 'website' && newValue.length > 3) return newValue;
      if (existing.includes('...') && !newValue.includes('...')) return newValue;
      break;
      
    case 'description':
      // Prefer descriptive content for social media
      if (newValue.length > existing.length && newValue.length > 30) return newValue;
      if (existing.includes('Enjoy the videos') && !newValue.includes('Enjoy the videos')) return newValue;
      if (existing.toLowerCase().startsWith('visit ') && newValue.length > 20) return newValue;
      if (existing.includes('Upload original content') && newValue.length > 10) return newValue;
      break;
      
    case 'image':
      // Prefer high-quality images for social media
      if (existing.includes('favicons') && !newValue.includes('favicons')) return newValue;
      if (newValue.includes('maxresdefault') && !existing.includes('maxresdefault')) return newValue;
      if (newValue.includes('hqdefault') && existing.includes('default.jpg')) return newValue;
      if (newValue.includes('1200') || newValue.includes('og:image')) return newValue;
      break;
      
    case 'favicon':
      // Prefer specific favicons over generic ones
      if (existing.includes('favicons') && !newValue.includes('favicons')) return newValue;
      if (newValue.includes('apple-touch-icon') && !existing.includes('apple-touch-icon')) return newValue;
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
        // For existing URLs, always try to ensure social media optimization
        if (!existingData.socialMediaOptimized || isWeakMetadata(existingData)) {
          console.log(`[createShortCode] Optimizing existing URL for social media`);
          try {
            const freshMetadata = await fetchPageMetadata(normalizedUrl);
            if (freshMetadata && (freshMetadata.title || freshMetadata.description || freshMetadata.image)) {
              await updateUrlData(existingShortCode, {
                ...freshMetadata,
                socialMediaOptimized: true
              });
              console.log(`[createShortCode] Social media optimization completed for existing URL`);
            }
          } catch (refreshError) {
            console.warn(`[createShortCode] Failed to optimize existing URL:`, refreshError);
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

  // Enhanced metadata fetching for social media optimization
  let enhancedMetadata = metadata || {};
  
  console.log(`[createShortCode] Fetching social media optimized metadata for: ${normalizedUrl}`);
  try {
    const fetchedMetadata = await Promise.race([
      fetchPageMetadata(normalizedUrl),
      new Promise<null>((_, reject) => 
        setTimeout(() => reject(new Error('Metadata fetch timeout')), 35000)
      )
    ]);
    
    if (fetchedMetadata) {
      enhancedMetadata = {
        title: chooseBetterValue(enhancedMetadata.title, fetchedMetadata.title, 'title') || fetchedMetadata.title,
        description: chooseBetterValue(enhancedMetadata.description, fetchedMetadata.description, 'description') || fetchedMetadata.description,
        image: chooseBetterValue(enhancedMetadata.image, fetchedMetadata.image, 'image') || fetchedMetadata.image,
        favicon: chooseBetterValue(enhancedMetadata.favicon, fetchedMetadata.favicon, 'favicon') || fetchedMetadata.favicon,
        socialMediaOptimized: true, // Mark as optimized since we fetched fresh data
      };
      
      console.log(`[createShortCode] Enhanced metadata for social media:`, {
        title: enhancedMetadata.title ? `${enhancedMetadata.title.substring(0, 50)}...` : 'none',
        description: enhancedMetadata.description ? `${enhancedMetadata.description.substring(0, 50)}...` : 'none',
        hasImage: !!enhancedMetadata.image,
        hasFavicon: !!enhancedMetadata.favicon,
        socialOptimized: enhancedMetadata.socialMediaOptimized
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
        favicon: enhancedMetadata.favicon || `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=128`,
        socialMediaOptimized: false, // Mark as not optimized since we used fallback
      };
    } catch {
      enhancedMetadata = {
        title: "Website",
        description: "",
        image: "",
        favicon: "/favicon.ico",
        socialMediaOptimized: false,
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
    socialMediaOptimized: enhancedMetadata.socialMediaOptimized || false,
  }
  
  console.log(`[createShortCode] Final URL data for social sharing:`, {
    originalUrl: urlData.originalUrl,
    title: urlData.title,
    description: urlData.description ? `${urlData.description.substring(0, 50)}...` : 'none',
    hasImage: !!urlData.image,
    hasFavicon: !!urlData.favicon,
    socialMediaOptimized: urlData.socialMediaOptimized,
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