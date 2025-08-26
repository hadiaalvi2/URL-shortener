import fs from 'fs'
import path from 'path'
import { kv } from "@vercel/kv"

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
  return await kv.get<UrlData>(`url:${shortCode}`)
}

export async function saveUrlToKV(shortCode: string, data: UrlData) {
  await kv.set(`url:${shortCode}`, data)
}

// File-based storage functions
const dataDir = path.join(process.cwd(), 'data')
const dataFile = path.join(dataDir, 'urls.json')

// Initialize storage file
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true })
}

if (!fs.existsSync(dataFile)) {
  fs.writeFileSync(dataFile, JSON.stringify({ codeToUrl: {}, urlToCode: {} }))
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
    throw new Error('Failed to write URL storage')
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
  if (!url || typeof url !== 'string') {
    throw new Error('Invalid URL provided');
  }
  
  const storage = readStorage()
  const normalizedUrl = normalizeUrl(url);
  
  // Check if URL already exists
  if (storage.urlToCode && storage.urlToCode[normalizedUrl]) {
    const existingShortCode = storage.urlToCode[normalizedUrl];
    // Verify the short code still exists in codeToUrl
    if (storage.codeToUrl && storage.codeToUrl[existingShortCode]) {
      return existingShortCode;
    } else {
      // Clean up orphaned entry
      delete storage.urlToCode[normalizedUrl];
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
  } while (storage.codeToUrl && storage.codeToUrl[shortCode]);

  // Initialize storage objects if they don't exist
  if (!storage.codeToUrl) storage.codeToUrl = {};
  if (!storage.urlToCode) storage.urlToCode = {};

  // Store the data - use original URL for codeToUrl but normalized for urlToCode
  storage.codeToUrl[shortCode] = {
    originalUrl: url, // Store the original URL as provided
    title: metadata?.title,
    description: metadata?.description,
    image: metadata?.image,
    favicon: metadata?.favicon,
  };
  
  storage.urlToCode[normalizedUrl] = shortCode;
  
  writeStorage(storage);
  return shortCode;
}

export function getAllUrls(): Record<string, string> {
  const storage = readStorage();
  const result: Record<string, string> = {};
  
  if (storage.codeToUrl) {
    Object.entries(storage.codeToUrl).forEach(([shortCode, data]) => {
      result[shortCode] = data.originalUrl;
    });
  }
  
  return result;
}