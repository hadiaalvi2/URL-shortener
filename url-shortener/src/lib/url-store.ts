import { promises as fs } from 'fs';
import path from 'path';

const DB_FILE = path.resolve(process.cwd(), 'data', 'urls.json');

// Define URL data structure
interface UrlData {
  originalUrl: string;
  title?: string;
  description?: string;
  image?: string;
  favicon?: string;
}

interface UrlMap {
  [key: string]: UrlData;
}

// Initialize maps
const codeToUrl = new Map<string, UrlData>();
const urlToCode = new Map<string, string>();

async function loadStore() {
  try {
    console.log('Attempting to load URL store from:', DB_FILE);
    const data = await fs.readFile(DB_FILE, 'utf-8');
    const parsedData: UrlMap = JSON.parse(data);

    // Clear existing data
    codeToUrl.clear();
    urlToCode.clear();

    // Populate Maps
    for (const [code, urlData] of Object.entries(parsedData)) {
      codeToUrl.set(code, urlData);
      urlToCode.set(urlData.originalUrl, code);
    }

    console.log('URL store loaded successfully. Total entries:', codeToUrl.size);
  } catch (error: unknown) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      console.log('URL store file not found. Creating empty store.');
      await fs.mkdir(path.dirname(DB_FILE), { recursive: true });
      await fs.writeFile(DB_FILE, JSON.stringify({}, null, 2), 'utf-8');
      console.log('Empty URL store file created.');
    } else {
      console.error('Error loading URL store:', error instanceof Error ? error.message : 'Unknown error');
    }
  }
}

async function saveStore() {
  try {
    console.log('Attempting to save URL store to:', DB_FILE, '. Current entries:', codeToUrl.size);
    
    // Convert Map to plain object for JSON serialization
    const data: UrlMap = {};
    for (const [code, urlData] of codeToUrl.entries()) {
      data[code] = urlData;
    }
    
    await fs.writeFile(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
    console.log('URL store saved successfully.');
  } catch (error: unknown) {
    console.error('Error saving URL store:', error instanceof Error ? error.message : 'Unknown error');
  }
}

// Load the store when the module is initialized
loadStore();

function makeCode(len = 6): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "";
  while (out.length < len) out += chars[Math.floor(Math.random() * chars.length)];
  if (codeToUrl.has(out)) return makeCode(len);
  return out;
}

/**
 * Save a new URL with metadata
 */
export async function saveUrl(longUrl: string, meta?: Partial<Omit<UrlData, 'originalUrl'>>): Promise<string> {
  console.log('saveUrl called for:', longUrl);
  
  // Normalize URL
  let normalized: string;
  try {
    normalized = new URL(longUrl).toString();
  } catch (error) {
    throw new Error('Invalid URL provided');
  }

  if (urlToCode.has(normalized)) {
    console.log('URL already exists, returning existing short code.');
    return urlToCode.get(normalized)!;
  }

  const code = makeCode(6);
  const urlData: UrlData = {
    originalUrl: normalized,
    title: meta?.title,
    description: meta?.description,
    image: meta?.image,
    favicon: meta?.favicon
  };

  codeToUrl.set(code, urlData);
  urlToCode.set(normalized, code);

  console.log(`Generated new short code: ${code} for URL: ${normalized}`);
  await saveStore();
  return code;
}

/**
 * Get full URL data (not just the original URL)
 */
export function getUrl(shortCode: string): UrlData | null {
  console.log('getUrl called for shortCode:', shortCode);
  const data = codeToUrl.get(shortCode) ?? null;
  console.log(`Found data for shortCode ${shortCode}:`, data);
  return data;
}