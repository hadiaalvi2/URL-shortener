import { kv } from "@vercel/kv";

interface UrlData {
  originalUrl: string;
  title?: string;
  description?: string;
  image?: string;
  favicon?: string;
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
    const urlData = await kv.hgetall<UrlData>(shortCode);
    if (urlData) {
      return urlData.originalUrl;
    }
    return null;
  } catch (error) {
    console.error('Error getting original URL from KV:', error);
    return null;
  }
}

export async function getUrl(shortCode: string): Promise<UrlData | undefined> {
  try {
    const urlData = await kv.hgetall<UrlData>(shortCode);
    return urlData || undefined;
  } catch (error) {
    console.error('Error getting URL data from KV:', error);
    return undefined;
  }
}

export async function createShortCode(url: string, metadata?: Partial<UrlData>): Promise<string> {
  if (!url || typeof url !== 'string') {
    throw new Error('Invalid URL provided');
  }

  const normalizedUrl = normalizeUrl(url);


  const allKeys = await kv.keys("*"); 
  for (const key of allKeys) {
    const storedUrlData = await kv.hgetall<UrlData>(key);
    if (storedUrlData && normalizeUrl(storedUrlData.originalUrl) === normalizedUrl) {
      return key; 
    }
  }

  let shortCode: string;
  let attempts = 0;
  do {
    shortCode = Math.random().toString(36).substring(2, 10);
    attempts++;
    if (attempts > 10) {
      throw new Error('Failed to generate unique short code');
    }
  } while (await kv.exists(shortCode)); 

  await kv.hset(shortCode, {
    originalUrl: url,
    title: metadata?.title,
    description: metadata?.description,
    image: metadata?.image,
    favicon: metadata?.favicon,
  });

  return shortCode;
}

export async function getAllUrls(): Promise<{ shortCode: string; originalUrl: string }[]> {
  try {
    const allKeys = await kv.keys("*");
    const urls: { shortCode: string; originalUrl: string }[] = [];

    for (const key of allKeys) {
      const urlData = await kv.hgetall<UrlData>(key);
      if (urlData) {
        urls.push({
          shortCode: key,
          originalUrl: urlData.originalUrl,
        });
      }
    }
    return urls;
  } catch (error) {
    console.error('Error getting all URLs from KV:', error);
    return [];
  }
}