interface StoredUrlData {
  originalUrl: string;
  title?: string;
  description?: string;
  image?: string;
  favicon?: string;
  createdAt: number;
}

const urlStore = new Map<string, StoredUrlData>();

export interface UrlData {
  originalUrl: string;
  title?: string;
  description?: string;
  image?: string;
  favicon?: string;
  createdAt: number;
  [key: string]: unknown;
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
  const data = urlStore.get(shortCode);
  return data?.originalUrl || null;
}

export async function getUrl(shortCode: string): Promise<UrlData | undefined> {
  const data = urlStore.get(shortCode);
  if (!data) return undefined;
  
  return {
    originalUrl: data.originalUrl,
    title: data.title,
    description: data.description,
    image: data.image,
    favicon: data.favicon,
    createdAt: data.createdAt
  };
}

export async function createShortCode(url: string, metadata?: Partial<Omit<StoredUrlData, 'createdAt'>>): Promise<string> {
  if (!url || typeof url !== 'string') {
    throw new Error('Invalid URL provided');
  }

  const normalizedUrl = normalizeUrl(url);

  for (const [existingShortCode, existingData] of urlStore.entries()) {
    if (normalizeUrl(existingData.originalUrl) === normalizedUrl) {
      return existingShortCode;
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
  } while (urlStore.has(shortCode));

  const urlData: StoredUrlData = {
    originalUrl: url,
    title: metadata?.title,
    description: metadata?.description,
    image: metadata?.image,
    favicon: metadata?.favicon,
    createdAt: Date.now()
  };

  urlStore.set(shortCode, urlData);
  console.log(`Created short code: ${shortCode} for URL: ${url}`);

  return shortCode;
}

export async function getAllUrls(): Promise<{ shortCode: string; originalUrl: string }[]> {
  const result: { shortCode: string; originalUrl: string }[] = [];
  
  for (const [shortCode, data] of urlStore.entries()) {
    result.push({
      shortCode,
      originalUrl: data.originalUrl
    });
  }
  
  return result;
}

export function getStoreStats() {
  return {
    size: urlStore.size,
    keys: Array.from(urlStore.keys())
  };
}