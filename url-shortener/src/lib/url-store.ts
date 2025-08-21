import { promises as fs } from 'fs';
import path from 'path';

const DB_FILE = path.resolve(process.cwd(), 'data', 'urls.json');

interface UrlMap {
  [key: string]: string;
}

let codeToUrl = new Map<string, string>();
let urlToCode = new Map<string, string>();

async function loadStore() {
  try {
    console.log('Attempting to load URL store from:', DB_FILE);
    const data = await fs.readFile(DB_FILE, 'utf-8');
    const parsedData: UrlMap = JSON.parse(data);
    codeToUrl = new Map(Object.entries(parsedData));
    urlToCode = new Map(Object.entries(parsedData).map(([code, url]) => [url, code]));
    console.log('URL store loaded successfully. Total entries:', codeToUrl.size);
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      console.log('URL store file not found. Creating empty store.');
      await fs.mkdir(path.dirname(DB_FILE), { recursive: true });
      await fs.writeFile(DB_FILE, JSON.stringify({}), 'utf-8');
      console.log('Empty URL store file created.');
    } else {
      console.error('Error loading URL store:', error);
    }
  }
}

async function saveStore() {
  try {
    console.log('Attempting to save URL store to:', DB_FILE, '. Current entries:', codeToUrl.size);
    const data: UrlMap = Object.fromEntries(codeToUrl);
    await fs.writeFile(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
    console.log('URL store saved successfully.');
  } catch (error) {
    console.error('Error saving URL store:', error);
  }
}

// Load the store when the module is initialized
loadStore();

function makeCode(len = 6) {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
  let out = ""
  while (out.length < len) out += chars[Math.floor(Math.random() * chars.length)]
  if (codeToUrl.has(out)) return makeCode(len)
  return out
}

export async function saveUrl(longUrl: string): Promise<string> {
  console.log('saveUrl called for:', longUrl);
  const normalized = new URL(longUrl).toString()

  if (urlToCode.has(normalized)) {
    console.log('URL already exists, returning existing short code.');
    return urlToCode.get(normalized)!
  }
  const code = makeCode(6)
  codeToUrl.set(code, normalized)
  urlToCode.set(normalized, code)
  console.log(`Generated new short code: ${code} for URL: ${normalized}`);
  await saveStore(); // Persist changes
  return code
}

export function getUrl(shortCode: string): string | null {
  console.log('getUrl called for shortCode:', shortCode);
  const url = codeToUrl.get(shortCode) ?? null;
  console.log(`Found URL: ${url} for shortCode: ${shortCode}`);
  return url
}
