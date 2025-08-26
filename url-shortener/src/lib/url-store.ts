import fs from 'fs'
import path from 'path'

const dataDir = path.join(process.cwd(), 'data')
const dataFile = path.join(dataDir, 'urls.json')

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true })
}

if (!fs.existsSync(dataFile)) {
  fs.writeFileSync(dataFile, JSON.stringify({ codeToUrl: {}, urlToCode: {} }))
}

interface UrlData {
  originalUrl: string
  title?: string
  description?: string
  image?: string
  favicon?: string
}

interface UrlStorage {
  codeToUrl: Record<string, UrlData>
  urlToCode: Record<string, string>
}

function readStorage(): UrlStorage {
  try {
    const data = fs.readFileSync(dataFile, 'utf8')
    return JSON.parse(data)
  } catch (error) {
    console.error('Error reading URL storage:', error)
    return { codeToUrl: {}, urlToCode: {} }
  }
}

function writeStorage(storage: UrlStorage): void {
  try {
    fs.writeFileSync(dataFile, JSON.stringify(storage, null, 2))
  } catch (error) {
    console.error('Error writing URL storage:', error)
  }
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
    const storage = readStorage();
    
   
    if (storage.codeToUrl && storage.codeToUrl[shortCode]) {
      return storage.codeToUrl[shortCode].originalUrl;
    }
    
    return null;
  } catch (error) {
    console.error('Error getting original URL:', error);
    return null;
  }
}

export function getUrl(shortCode: string): UrlData | undefined {
  const storage = readStorage()
  return storage.codeToUrl[shortCode]
}

export function createShortCode(url: string, metadata?: Partial<UrlData>): string {
  const storage = readStorage()
  
  if (!url || typeof url !== 'string') {
    throw new Error('Invalid URL provided');
  }
  
  const normalizedUrl = normalizeUrl(url);
  
  const existingShortCode = storage.urlToCode ? storage.urlToCode[normalizedUrl] : undefined;
  
  if (existingShortCode) {
    
    if (storage.codeToUrl && storage.codeToUrl[existingShortCode]) {
      return existingShortCode;
    } else {
      
      if (storage.urlToCode) {
        delete storage.urlToCode[normalizedUrl];
      }
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
  } while (storage.codeToUrl && storage.codeToUrl[shortCode]);

  if (!storage.codeToUrl) storage.codeToUrl = {};
  if (!storage.urlToCode) storage.urlToCode = {};

  // Store the data
  storage.codeToUrl[shortCode] = {
    originalUrl: url, 
    title: metadata?.title,
    description: metadata?.description,
    image: metadata?.image,
    favicon: metadata?.favicon,
  };
  
  storage.urlToCode[normalizedUrl] = shortCode; 
  
  writeStorage(storage);
  return shortCode;
}

export function getAllUrls(): { shortCode: string; originalUrl: string }[] {
  const storage = readStorage();
  
  if (!storage.codeToUrl) {
    return [];
  }
  
  return Object.entries(storage.codeToUrl).map(([shortCode, data]) => ({
    shortCode,
    originalUrl: data.originalUrl,
  }));
}