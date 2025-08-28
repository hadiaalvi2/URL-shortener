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

// Enhanced function to detect generic metadata
export function isWeakMetadata(data?: Partial<UrlData> | null): boolean {
  if (!data) return true;
  
  const genericTitle = data.title?.toLowerCase().startsWith("page from ") ?? false;
  const genericDescription = isGenericDescription(data.description);
  const googleFavicon = data.favicon?.includes("google.com/s2/favicons") ?? false;
  const missingCore = !data.title && !data.description && !data.image;
  
  return genericTitle || genericDescription || googleFavicon || missingCore;
}

// Function to detect and filter generic descriptions
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
  ];
  
  const isTooShort = desc.trim().length < 25;
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

  // Special handling for YouTube URLs to ensure dynamic descriptions
  try {
    const urlObj = new URL(normalizedUrl);
    const isYouTube = urlObj.hostname.includes('youtube.com') || urlObj.hostname === 'youtu.be';
    
    if (isYouTube && (!enhancedMetadata.description || isGenericDescription(enhancedMetadata.description))) {
      // Try to extract better YouTube description
      const youtubeDescription = await extractYouTubeDescription(normalizedUrl);
      if (youtubeDescription && !isGenericDescription(youtubeDescription)) {
        enhancedMetadata.description = youtubeDescription;
      }
    }
  } catch (error) {
    console.error('Error in YouTube-specific handling:', error);
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

// Enhanced YouTube description extraction
async function extractYouTubeDescription(url: string): Promise<string | undefined> {
  try {
    console.log(`Extracting YouTube description for: ${url}`);
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    });
    
    const html = await response.text();
    
    // Multiple extraction strategies for YouTube
    const extractionPatterns = [
      /"description":"([^"]+)"/,
      /"shortDescription":"([^"]+)"/,
      /"videoDescription":"([^"]+)"/,
      /<meta name="description" content="([^"]+)">/,
      /"content":"([^"]{50,500})"/ // General content extraction
    ];
    
    for (const pattern of extractionPatterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        const description = match[1]
          .replace(/\\n/g, ' ')
          .replace(/\\"/g, '"')
          .replace(/\\u([0-9a-fA-F]{4})/g, (_m, g1) => String.fromCharCode(parseInt(g1, 16)))
          .trim();
        
        if (description && description.length > 30 && !isGenericDescription(description)) {
          console.log(`Found YouTube description: ${description.substring(0, 100)}...`);
          return description;
        }
      }
    }
    
    // Fallback: Extract from JSON-LD
    const jsonLdMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    if (jsonLdMatch) {
      try {
        const jsonData = JSON.parse(jsonLdMatch[1]);
        const description = jsonData?.description || jsonData?.videoDescription;
        if (description && !isGenericDescription(description)) {
          return description;
        }
      } catch (e) {
        console.error('Error parsing JSON-LD:', e);
      }
    }
    
  } catch (error) {
    console.error('Error extracting YouTube description:', error);
  }
  
  return undefined;
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