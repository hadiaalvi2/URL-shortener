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

export function isWeakMetadata(data?: Partial<UrlData> | null): boolean {
  if (!data) return true;
  const genericTitle = data.title?.toLowerCase().startsWith("page from ") ?? false;
  const genericDescription = data.description === "Check out this shared link";
  const googleFavicon = data.favicon?.includes("google.com/s2/favicons") ?? false;
  const missingCore = !data.title && !data.description && !data.image;
  return genericTitle || genericDescription || googleFavicon || missingCore;
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

  // Store the data in KV
  const urlData: UrlData = {
    originalUrl: url,
    title: metadata?.title,
    description: metadata?.description,
    image: metadata?.image,
    favicon: metadata?.favicon,
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