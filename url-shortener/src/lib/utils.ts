import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import * as cheerio from "cheerio"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

async function safeFetch(
  url: string,
  options: RequestInit = {},
  timeout = 15000
): Promise<Response> {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; URL-Shortener/1.0; +https://example.com/bot)",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "DNT": "1",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
        ...options.headers,
      },
    })
    return response
  } finally {
    clearTimeout(id)
  }
}

// ---- Enhanced General Page Metadata ----
export async function fetchPageMetadata(url: string, retryCount = 2) {
  console.log(`[fetchPageMetadata] Starting metadata fetch for: ${url}`)
  
  for (let attempt = 1; attempt <= retryCount; attempt++) {
    try {
      const isYouTube = url.includes("youtube.com") || url.includes("youtu.be")
      if (isYouTube) {
        console.log(`[fetchPageMetadata] Detected YouTube URL, using specialized extraction`)
        return await fetchYouTubeMetadata(url)
      }

      const response = await safeFetch(url, {
        redirect: "follow",
      })

      const effectiveUrl = response.url || url

      if (!response.ok) {
        console.error(
          `[fetchPageMetadata] Failed to fetch ${url}: ${response.status} ${response.statusText}`
        )
        
        if (attempt < retryCount) {
          console.log(`[fetchPageMetadata] Retrying... (attempt ${attempt + 1}/${retryCount})`)
          continue
        }
        
        return { 
          title: extractDomainTitle(url), 
          description: "", 
          image: "", 
          favicon: getDefaultFavicon(url) 
        }
      }

      const html = await response.text()
      
      if (!html || html.trim().length === 0) {
        console.error(`[fetchPageMetadata] Empty response for ${url}`)
        if (attempt < retryCount) continue
        return { 
          title: extractDomainTitle(url), 
          description: "", 
          image: "", 
          favicon: getDefaultFavicon(url) 
        }
      }

      return parseHtmlMetadata(html, effectiveUrl)

    } catch (error) {
      console.error(`[fetchPageMetadata] Attempt ${attempt} failed for ${url}:`, error)
      
      if (attempt < retryCount) {
        await new Promise(resolve => setTimeout(resolve, 1000))
        continue
      }
      
      return {
        title: extractDomainTitle(url),
        description: "",
        image: "",
        favicon: getDefaultFavicon(url),
      }
    }
  }

  return {
    title: extractDomainTitle(url),
    description: "",
    image: "",
    favicon: getDefaultFavicon(url),
  }
}

function parseHtmlMetadata(html: string, effectiveUrl: string) {
  let title = ""
  let description = ""
  let image = ""
  let favicon = ""

  try {
    const $ = cheerio.load(html)

    // Extract title with multiple fallbacks
    title = 
      $("meta[property='og:title']").attr("content")?.trim() ||
      $("meta[name='twitter:title']").attr("content")?.trim() ||
      $("meta[name='title']").attr("content")?.trim() ||
      $("title").text()?.trim() ||
      $("h1").first().text()?.trim() ||
      extractDomainTitle(effectiveUrl)

    // Extract description with multiple fallbacks
    description = 
      $("meta[property='og:description']").attr("content")?.trim() ||
      $("meta[name='description']").attr("content")?.trim() ||
      $("meta[name='twitter:description']").attr("content")?.trim() ||
      $("meta[itemprop='description']").attr("content")?.trim() ||
      ""

    // Extract image with multiple fallbacks
    image = 
      $("meta[property='og:image']").attr("content")?.trim() ||
      $("meta[property='og:image:url']").attr("content")?.trim() ||
      $("meta[name='twitter:image']").attr("content")?.trim() ||
      $("meta[name='twitter:image:src']").attr("content")?.trim() ||
      $("meta[itemprop='image']").attr("content")?.trim() ||
      $("link[rel='image_src']").attr("href")?.trim() ||
      ""

    // Extract favicon with multiple fallbacks
    favicon = 
      $("link[rel='icon']").attr("href")?.trim() ||
      $("link[rel='shortcut icon']").attr("href")?.trim() ||
      $("link[rel='apple-touch-icon']").attr("href")?.trim() ||
      $("link[rel='apple-touch-icon-precomposed']").attr("href")?.trim() ||
      ""

  } catch (e) {
    console.error("[fetchPageMetadata] Error parsing HTML:", e)
    return {
      title: extractDomainTitle(effectiveUrl),
      description: "",
      image: "",
      favicon: getDefaultFavicon(effectiveUrl),
    }
  }

  // Resolve relative URLs
  try {
    const baseUrl = new URL(effectiveUrl)

    if (image && !image.startsWith("http")) {
      image = new URL(image, baseUrl.origin).toString()
    }

    if (favicon && !favicon.startsWith("http")) {
      favicon = new URL(favicon, baseUrl.origin).toString()
    }
  } catch (e) {
    console.error("[fetchPageMetadata] Error resolving URLs:", e)
  }

  // Fallback for favicon
  if (!favicon) {
    favicon = getDefaultFavicon(effectiveUrl)
  }

  // Cleanup and validation
  title = cleanupText(title)
  description = cleanupText(description)

  // Validate image URL
  if (image && !isValidUrl(image)) {
    image = ""
  }

  console.log(`[fetchPageMetadata] Extracted metadata:`, {
    title,
    description: description ? `${description.substring(0, 50)}...` : "none",
    hasImage: !!image,
    hasFavicon: !!favicon,
  })

  return {
    title,
    description,
    image,
    favicon,
  }
}

// ---- Enhanced YouTube Metadata Extraction ----
async function fetchYouTubeMetadata(url: string): Promise<{
  title: string
  description: string
  image: string
  favicon: string
}> {
  try {
    console.log(`[fetchYouTubeMetadata] Extracting metadata for YouTube video: ${url}`)

    const videoId = getYouTubeVideoId(url)
    if (!videoId) {
      console.error("Could not extract YouTube video ID")
      return { 
        title: "YouTube Video", 
        description: "Watch this video on YouTube", 
        image: "", 
        favicon: "https://www.youtube.com/favicon.ico" 
      }
    }

    // Method 1: Try YouTube Data API if available
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (apiKey) {
      try {
        const apiUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${apiKey}`
        const response = await safeFetch(apiUrl)
        
        if (response.ok) {
          const data = await response.json()
          if (data.items && data.items.length > 0) {
            const snippet = data.items[0].snippet
            const title = snippet.title || "YouTube Video"
            const description = snippet.description || `Watch "${title}" on YouTube`
            const thumbnailUrl = snippet.thumbnails?.maxres?.url || 
                               snippet.thumbnails?.high?.url || 
                               snippet.thumbnails?.medium?.url ||
                               `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`

            console.log(`[fetchYouTubeMetadata] API success:`, { title })

            return {
              title,
              description: description.substring(0, 300), // Limit description length
              image: thumbnailUrl,
              favicon: "https://www.youtube.com/favicon.ico",
            }
          }
        }
      } catch (apiError) {
        console.log("[fetchYouTubeMetadata] API failed, trying oEmbed:", apiError)
      }
    }

    // Method 2: Try oEmbed
    try {
      const oEmbedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
      const response = await safeFetch(oEmbedUrl)

      if (response.ok) {
        const data = await response.json()
        const title = data.title || "YouTube Video"
        const thumbnailUrl = data.thumbnail_url || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`
        const authorName = data.author_name || "YouTube Creator"

        const description = `Video by ${authorName} on YouTube`

        console.log(`[fetchYouTubeMetadata] oEmbed success:`, { title, authorName })

        return {
          title,
          description,
          image: thumbnailUrl,
          favicon: "https://www.youtube.com/favicon.ico",
        }
      }
    } catch (oEmbedError) {
      console.log("[fetchYouTubeMetadata] oEmbed failed, trying direct scrape:", oEmbedError)
    }

    // Method 3: Direct scrape as fallback
    try {
      const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`
      const response = await safeFetch(youtubeUrl, {
        headers: {
          "Accept-Language": "en-US,en;q=0.9",
        },
      })

      if (response.ok) {
        const html = await response.text()
        const $ = cheerio.load(html)

        const title =
          $('meta[property="og:title"]').attr("content")?.trim() ||
          $("title").text().replace(" - YouTube", "").trim() ||
          "YouTube Video"

        let description =
          $('meta[property="og:description"]').attr("content")?.trim() ||
          $('meta[name="description"]').attr("content")?.trim() ||
          ""

        // Clean up generic YouTube descriptions
        if (!description || 
            description.includes("Enjoy the videos") || 
            description.includes("Upload original content")) {
          description = `Watch "${title}" on YouTube`
        }

        const imageUrl =
          $('meta[property="og:image"]').attr("content")?.trim() ||
          `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`

        console.log(`[fetchYouTubeMetadata] Direct scrape success:`, { title })

        return {
          title,
          description: description.substring(0, 300),
          image: imageUrl,
          favicon: "https://www.youtube.com/favicon.ico",
        }
      }
    } catch (scrapeError) {
      console.log("[fetchYouTubeMetadata] Direct scrape failed:", scrapeError)
    }

    // Final fallback with video ID
    console.log("[fetchYouTubeMetadata] Using fallback metadata")
    return {
      title: "YouTube Video",
      description: "Watch this video on YouTube",
      image: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
      favicon: "https://www.youtube.com/favicon.ico",
    }
  } catch (error) {
    console.error("[fetchYouTubeMetadata] Error extracting YouTube metadata:", error)
    return { 
      title: "YouTube Video", 
      description: "Watch this video on YouTube", 
      image: "", 
      favicon: "https://www.youtube.com/favicon.ico" 
    }
  }
}

// ---- Helper Functions ----
function getYouTubeVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/,
    /youtube\.com\/watch\?v=([^&]+)/,
    /youtube\.com\/embed\/([^\/]+)/,
    /youtu\.be\/([^\/]+)/,
    /youtube\.com\/shorts\/([^\/\?]+)/,
  ]

  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match && match[1]) {
      return match[1]
    }
  }
  return null
}

function extractDomainTitle(url: string): string {
  try {
    const domain = new URL(url).hostname
    return domain.replace('www.', '').replace(/\.[^.]+$/, '')
      .split('.').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join(' ')
  } catch {
    return "Untitled"
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

function cleanupText(text: string): string {
  if (!text) return ""
  
  return text
    .replace(/\s+/g, " ")
    .replace(/[\r\n\t]/g, " ")
    .trim()
    .substring(0, 300) // Limit length
}

function isValidUrl(string: string): boolean {
  try {
    new URL(string)
    return true
  } catch {
    return false
  }
}