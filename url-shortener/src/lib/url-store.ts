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

export function getUrl(shortCode: string): UrlData | undefined {
  const storage = readStorage()
  return storage.codeToUrl[shortCode]
}

export function createShortCode(url: string, metadata?: Partial<UrlData>): string {
  const storage = readStorage()
  
  // Check if URL already has a short code
  if (storage.urlToCode[url]) {
    return storage.urlToCode[url]
  }

  
  const shortCode = Math.random().toString(36).substring(2, 10)
  

  storage.codeToUrl[shortCode] = {
    originalUrl: url,
    title: metadata?.title,
    description: metadata?.description,
    image: metadata?.image,
    favicon: metadata?.favicon,
  }
  storage.urlToCode[url] = shortCode
  
  writeStorage(storage)
  return shortCode
}

export function getAllUrls(): { shortCode: string; originalUrl: string }[] {
  const storage = readStorage()
  return Object.entries(storage.codeToUrl).map(([shortCode, data]) => ({
    shortCode,
    originalUrl: data.originalUrl,
  }))
}