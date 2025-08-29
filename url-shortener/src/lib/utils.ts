import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import * as cheerio from "cheerio"

interface MetadataResult {
  title?: string;
  description?: string;
  image?: string;
  favicon?: string;
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

async function safeFetch(
  url: string,
  options: RequestInit = {},
  timeout = 8000 // Reduced from 20000
): Promise<Response> {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Cache-Control": "no-cache",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
        "Upgrade-Insecure-Requests": "1",
        ...options.headers,
      },
    })
    return response
  } finally {
    clearTimeout(id)
  }
}

// Optimized metadata extraction with faster timeouts
export async function fetchPageMetadata(url: string, retryCount = 1): Promise<MetadataResult> {
  console.log(`[fetchPageMetadata] Starting fast metadata fetch for: ${url}`)

  // Normalize URL first
  let normalizedUrl = url
  try {
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      normalizedUrl = "https://" + url
    }
    const urlObj = new URL(normalizedUrl)
    // Handle redirects for common patterns
    if (urlObj.hostname === 'youtu.be') {
      const videoId = urlObj.pathname.slice(1).split('?')[0]
      normalizedUrl = `https://www.youtube.com/watch?v=${videoId}`
    }
  } catch {
    console.error(`[fetchPageMetadata] Invalid URL: ${url}`)
    return getFallbackMetadata(url)
  }

  // Try extraction methods with shorter timeouts
  const extractionMethods = [
    () => tryDirectScraping(normalizedUrl),
    () => tryWithDifferentUserAgent(normalizedUrl)
  ]

  for (let method = 0; method < extractionMethods.length; method++) {
    for (let attempt = 1; attempt <= retryCount; attempt++) {
      try {
        console.log(`[fetchPageMetadata] Method ${method + 1}, Attempt ${attempt}/${retryCount}`)
        
        const metadata = await extractionMethods[method]()
        
        // Accept any non-empty metadata to avoid timeouts
        if (metadata && (metadata.title || metadata.description || metadata.image)) {
          console.log(`[fetchPageMetadata] Success with method ${method + 1}`)
          return metadata
        }
        
      } catch (err) {
        console.error(`[fetchPageMetadata] Method ${method + 1}, attempt ${attempt} failed:`, err)
        
        if (attempt < retryCount) {
          await new Promise(resolve => setTimeout(resolve, 500)) // Shorter wait
        }
      }
    }
  }

  console.log(`[fetchPageMetadata] All methods failed, using fallback`)
  return getFallbackMetadata(normalizedUrl)
}

async function tryDirectScraping(url: string): Promise<MetadataResult> {
  const response = await safeFetch(url, { redirect: "follow" }, 6000) // Reduced timeout
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  }

  const contentType = response.headers.get("content-type") || ""
  if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
    throw new Error(`Non-HTML content type: ${contentType}`)
  }

  const html = await response.text()
  if (!html || html.trim().length === 0) {
    throw new Error("Empty HTML response")
  }

  return parseHtmlMetadata(html, response.url || url)
}

async function tryWithDifferentUserAgent(url: string): Promise<MetadataResult> {
  const response = await safeFetch(url, {
    redirect: "follow",
    headers: {
      "User-Agent": "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
    }
  }, 5000) // Even shorter timeout for second method
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  }

  const html = await response.text()
  return parseHtmlMetadata(html, response.url || url)
}

function parseHtmlMetadata(html: string, effectiveUrl: string): MetadataResult {
  console.log(`[parseHtmlMetadata] Parsing HTML for metadata`)

  try {
    const $ = cheerio.load(html)

    // Quick and efficient extraction - prioritize speed over completeness
    const title = 
      $('meta[property="og:title"]').attr("content")?.trim() ||
      $('meta[name="twitter:title"]').attr("content")?.trim() ||
      $('title').first().text()?.trim() ||
      ""

    const description = 
      $('meta[property="og:description"]').attr("content")?.trim() ||
      $('meta[name="description"]').attr("content")?.trim() ||
      ""

    const image = 
      $('meta[property="og:image"]').attr("content")?.trim() ||
      $('meta[name="twitter:image"]').attr("content")?.trim() ||
      ""

    const favicon = 
      $('link[rel="icon"]').attr("href")?.trim() ||
      $('link[rel="shortcut icon"]').attr("href")?.trim() ||
      ""

    // Quick cleanup
    let cleanTitle = title;
    let cleanDescription = description;

    if (cleanTitle) {
      cleanTitle = cleanTitle.replace(/\s+/g, " ").trim().substring(0, 200) // Limit length
      cleanTitle = cleanTitle.replace(/ - YouTube$/, "").replace(/ \| [^|]+$/, "").trim()
    }

    if (cleanDescription) {
      cleanDescription = cleanDescription.replace(/\s+/g, " ").trim().substring(0, 300) // Limit length
      if (cleanDescription.includes("Enjoy the videos and music")) {
        cleanDescription = cleanDescription.split("Enjoy the videos and music")[0].trim()
      }
    }

    // Resolve relative URLs quickly
    let resolvedImage = image;
    let resolvedFavicon = favicon;

    if (image && !image.startsWith("http")) {
      try {
        resolvedImage = new URL(image, effectiveUrl).toString()
      } catch {
        resolvedImage = ""
      }
    }

    if (favicon && !favicon.startsWith("http")) {
      try {
        resolvedFavicon = new URL(favicon, effectiveUrl).toString()
      } catch {
        resolvedFavicon = ""
      }
    }

    // Quick YouTube special handling
    if (effectiveUrl.includes("youtube.com") || effectiveUrl.includes("youtu.be")) {
      const videoId = extractYouTubeVideoId(effectiveUrl)
      if (videoId) {
        if (!resolvedImage) {
          resolvedImage = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`
        }
        if (!resolvedFavicon) {
          resolvedFavicon = "https://www.youtube.com/favicon.ico"
        }
      }
    }

    // Fallbacks
    if (!cleanTitle) {
      cleanTitle = extractDomainTitle(effectiveUrl)
    }
    if (!resolvedFavicon) {
      resolvedFavicon = getDefaultFavicon(effectiveUrl)
    }

    return { 
      title: cleanTitle, 
      description: cleanDescription, 
      image: resolvedImage, 
      favicon: resolvedFavicon 
    }

  } catch (err) {
    console.error(`[parseHtmlMetadata] Error parsing HTML:`, err)
    return getFallbackMetadata(effectiveUrl)
  }
}

function getFallbackMetadata(url: string): MetadataResult {
  const title = extractDomainTitle(url)
  return {
    title,
    description: `Visit ${title}`,
    image: "",
    favicon: getDefaultFavicon(url)
  }
}

function extractYouTubeVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/,
    /youtube\.com\/watch\?v=([^&]+)/,
    /youtu\.be\/([^\/]+)/,
  ]

  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match && match[1]) {
      return match[1].substring(0, 11) // Ensure 11 characters max
    }
  }

  return null
}

function extractDomainTitle(url: string): string {
  try {
    const domain = new URL(url).hostname
    return domain
      .replace("www.", "")
      .replace(/\.[^.]+$/, "")
      .split(".")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ")
  } catch {
    return "Website"
  }
}

function getDefaultFavicon(url: string): string {
  try {
    const urlObj = new URL(url)
    return `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=128`
  } catch {
    return "/favicon.ico"
  }
}