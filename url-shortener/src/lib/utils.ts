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
        "User-Agent": "Mozilla/5.0 (compatible; LinkPreview/1.0; +http://linkpreview.net)",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
        ...options.headers,
      },
    })
    return response
  } finally {
    clearTimeout(id)
  }
}

// ---- Enhanced General Page Metadata ----
export async function fetchPageMetadata(url: string, retryCount = 3) {
  console.log(`[fetchPageMetadata] Starting metadata fetch for: ${url}`)
  
  // Normalize URL first
  let normalizedUrl = url
  try {
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      normalizedUrl = 'https://' + url
    }
    new URL(normalizedUrl) // Validate URL
  } catch (error) {
    console.error(`[fetchPageMetadata] Invalid URL: ${url}`)
    return {
      title: extractDomainTitle(url),
      description: "",
      image: "",
      favicon: getDefaultFavicon(url)
    }
  }

  for (let attempt = 1; attempt <= retryCount; attempt++) {
    try {
      console.log(`[fetchPageMetadata] Attempt ${attempt}/${retryCount} for: ${normalizedUrl}`)

      const isYouTube = normalizedUrl.includes("youtube.com") || normalizedUrl.includes("youtu.be")
      if (isYouTube) {
        console.log(`[fetchPageMetadata] Detected YouTube URL, using specialized extraction`)
        return await fetchYouTubeMetadata(normalizedUrl)
      }

      const response = await safeFetch(normalizedUrl, {
        redirect: "follow",
        method: "GET",
      })

      const effectiveUrl = response.url || normalizedUrl
      console.log(`[fetchPageMetadata] Response status: ${response.status}, effective URL: ${effectiveUrl}`)

      if (!response.ok) {
        console.error(`[fetchPageMetadata] HTTP error: ${response.status} ${response.statusText}`)
        
        // For 4xx errors, don't retry
        if (response.status >= 400 && response.status < 500 && attempt < retryCount) {
          console.log(`[fetchPageMetadata] Client error, skipping retries`)
          break
        }
        
        if (attempt < retryCount) {
          console.log(`[fetchPageMetadata] Retrying... (attempt ${attempt + 1}/${retryCount})`)
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt))
          continue
        }
        
        return { 
          title: extractDomainTitle(effectiveUrl), 
          description: "", 
          image: "", 
          favicon: getDefaultFavicon(effectiveUrl) 
        }
      }

      const contentType = response.headers.get('content-type') || ''
      console.log(`[fetchPageMetadata] Content-Type: ${contentType}`)

      if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
        console.warn(`[fetchPageMetadata] Non-HTML content type: ${contentType}`)
        return {
          title: extractDomainTitle(effectiveUrl),
          description: "",
          image: "",
          favicon: getDefaultFavicon(effectiveUrl)
        }
      }

      const html = await response.text()
      
      if (!html || html.trim().length === 0) {
        console.error(`[fetchPageMetadata] Empty HTML response`)
        if (attempt < retryCount) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt))
          continue
        }
        return { 
          title: extractDomainTitle(effectiveUrl), 
          description: "", 
          image: "", 
          favicon: getDefaultFavicon(effectiveUrl) 
        }
      }

      console.log(`[fetchPageMetadata] HTML length: ${html.length}`)
      const metadata = parseHtmlMetadata(html, effectiveUrl)
      
      // Validate that we got meaningful metadata
      if (!metadata.title || metadata.title === extractDomainTitle(effectiveUrl)) {
        if (attempt < retryCount) {
          console.log(`[fetchPageMetadata] Poor metadata quality, retrying...`)
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt))
          continue
        }
      }

      return metadata

    } catch (error) {
      console.error(`[fetchPageMetadata] Attempt ${attempt} failed for ${normalizedUrl}:`, error)
      
      if (attempt < retryCount) {
        console.log(`[fetchPageMetadata] Waiting before retry...`)
        await new Promise(resolve => setTimeout(resolve, 2000 * attempt))
        continue
      }
      
      return {
        title: extractDomainTitle(normalizedUrl),
        description: "",
        image: "",
        favicon: getDefaultFavicon(normalizedUrl),
      }
    }
  }

  // Final fallback
  return {
    title: extractDomainTitle(normalizedUrl),
    description: "",
    image: "",
    favicon: getDefaultFavicon(normalizedUrl),
  }
}

function parseHtmlMetadata(html: string, effectiveUrl: string) {
  let title = ""
  let description = ""
  let image = ""
  let favicon = ""

  console.log(`[parseHtmlMetadata] Parsing HTML for: ${effectiveUrl}`)

  try {
    const $ = cheerio.load(html, {
  xml: {
    decodeEntities: false 
  }
})

    // Extract title with comprehensive fallbacks
    const titleCandidates = [
      $("meta[property='og:title']").attr("content"),
      $("meta[name='twitter:title']").attr("content"),
      $("meta[property='twitter:title']").attr("content"),
      $("meta[name='title']").attr("content"),
      $("meta[itemprop='name']").attr("content"),
      $("title").text(),
      $("h1").first().text(),
      $("h2").first().text()
    ]

    for (const candidate of titleCandidates) {
      const cleaned = candidate?.trim()
      if (cleaned && cleaned.length > 0 && cleaned.length < 200) {
        title = cleaned
        break
      }
    }

    // Extract description with comprehensive fallbacks
    const descriptionCandidates = [
      $("meta[property='og:description']").attr("content"),
      $("meta[name='description']").attr("content"),
      $("meta[name='twitter:description']").attr("content"),
      $("meta[property='twitter:description']").attr("content"),
      $("meta[itemprop='description']").attr("content"),
      $("meta[name='summary']").attr("content"),
      $("p").first().text(),
    ]

    for (const candidate of descriptionCandidates) {
      const cleaned = candidate?.trim()
      if (cleaned && cleaned.length > 10 && cleaned.length < 500) {
        description = cleaned
        break
      }
    }

    // Extract image with comprehensive fallbacks
    const imageCandidates = [
      $("meta[property='og:image']").attr("content"),
      $("meta[property='og:image:url']").attr("content"),
      $("meta[name='twitter:image']").attr("content"),
      $("meta[property='twitter:image']").attr("content"),
      $("meta[name='twitter:image:src']").attr("content"),
      $("meta[itemprop='image']").attr("content"),
      $("link[rel='image_src']").attr("href"),
      $("article img").first().attr("src"),
      $("img").first().attr("src")
    ]

    for (const candidate of imageCandidates) {
      const cleaned = candidate?.trim()
      if (cleaned && cleaned.length > 0) {
        image = cleaned
        break
      }
    }

    // Extract favicon with comprehensive fallbacks
    const faviconCandidates = [
      $("link[rel='icon']").attr("href"),
      $("link[rel='shortcut icon']").attr("href"),
      $("link[rel='apple-touch-icon']").attr("href"),
      $("link[rel='apple-touch-icon-precomposed']").attr("href"),
      $("link[rel='mask-icon']").attr("href"),
      $("meta[name='msapplication-TileImage']").attr("content")
    ]

    for (const candidate of faviconCandidates) {
      const cleaned = candidate?.trim()
      if (cleaned && cleaned.length > 0) {
        favicon = cleaned
        break
      }
    }

    console.log(`[parseHtmlMetadata] Raw extracted:`, {
      title: title ? `${title.substring(0, 50)}...` : "none",
      description: description ? `${description.substring(0, 50)}...` : "none",
      image: image ? "found" : "none",
      favicon: favicon ? "found" : "none"
    })

  } catch (e) {
    console.error("[parseHtmlMetadata] Error parsing HTML:", e)
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
      if (image.startsWith("//")) {
        image = baseUrl.protocol + image
      } else if (image.startsWith("/")) {
        image = baseUrl.origin + image
      } else {
        image = new URL(image, baseUrl.origin).toString()
      }
    }

    if (favicon && !favicon.startsWith("http")) {
      if (favicon.startsWith("//")) {
        favicon = baseUrl.protocol + favicon
      } else if (favicon.startsWith("/")) {
        favicon = baseUrl.origin + favicon
      } else {
        favicon = new URL(favicon, baseUrl.origin).toString()
      }
    }
  } catch (e) {
    console.error("[parseHtmlMetadata] Error resolving URLs:", e)
  }

  // Apply fallbacks if needed
  if (!title || title.length === 0) {
    title = extractDomainTitle(effectiveUrl)
  }

  if (!favicon || favicon.length === 0) {
    favicon = getDefaultFavicon(effectiveUrl)
  }

  // Cleanup and validation
  title = cleanupText(title)
  description = cleanupText(description)

  // Validate URLs
  if (image && !isValidUrl(image)) {
    console.warn(`[parseHtmlMetadata] Invalid image URL: ${image}`)
    image = ""
  }

  if (favicon && !isValidUrl(favicon)) {
    console.warn(`[parseHtmlMetadata] Invalid favicon URL: ${favicon}`)
    favicon = getDefaultFavicon(effectiveUrl)
  }

  const finalResult = {
    title,
    description,
    image,
    favicon,
  }

  console.log(`[parseHtmlMetadata] Final metadata:`, {
    title: finalResult.title,
    description: finalResult.description ? `${finalResult.description.substring(0, 50)}...` : "none",
    hasImage: !!finalResult.image,
    hasFavicon: !!finalResult.favicon,
  })

  return finalResult
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

    // Method 1: Try YouTube Data API if available (most reliable)
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
        console.log("[fetchYouTubeMetadata] API failed, trying direct scrape:", apiError)
      }
    }

    // Method 2: Direct scrape with enhanced parsing
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
        
        // Extract title
        const title =
          $('meta[property="og:title"]').attr("content")?.trim() ||
          $("title").text().replace(" - YouTube", "").trim() ||
          "YouTube Video"

        // Extract description - try multiple approaches
        let description = ""
        
        // Try JSON-LD data (most reliable for description)
        try {
          const jsonLdScript = $('script[type="application/ld+json"]').html()
          if (jsonLdScript) {
            const jsonLd = JSON.parse(jsonLdScript)
            if (jsonLd.description) {
              description = jsonLd.description
            }
          }
        } catch (e) {
          console.log("Failed to parse JSON-LD:", e)
        }
        
        // Fallback to meta tags
        if (!description) {
          description =
            $('meta[property="og:description"]').attr("content")?.trim() ||
            $('meta[name="description"]').attr("content")?.trim() ||
            ""
        }
        
        // Clean up generic YouTube descriptions
        if (!description || 
            description.includes("Enjoy the videos") || 
            description.includes("Upload original content") ||
            description.includes("Music video by")) {
          description = `Watch "${title}" on YouTube`
        }

        // Extract image
        const imageUrl =
          $('meta[property="og:image"]').attr("content")?.trim() ||
          $('link[rel="image_src"]').attr("href")?.trim() ||
          `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`

        console.log(`[fetchYouTubeMetadata] Direct scrape success:`, { 
          title,
          description: description ? `${description.substring(0, 50)}...` : "none"
        })

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

    // Method 3: Try oEmbed as last resort
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
      console.log("[fetchYouTubeMetadata] oEmbed failed:", oEmbedError)
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

function cleanupText(text: string): string {
  if (!text) return ""
  
  return text
    .replace(/\s+/g, " ")
    .replace(/[\r\n\t]/g, " ")
    .replace(/[^\x20-\x7E\u00A0-\u024F\u1E00-\u1EFF]/g, "") // Remove unusual characters
    .trim()
    .substring(0, 300) // Limit length
}

function isValidUrl(string: string): boolean {
  try {
    const url = new URL(string)
    return url.protocol === "http:" || url.protocol === "https:"
  } catch {
    return false
  }
}