import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import * as cheerio from "cheerio"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
]

function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]
}

async function safeFetch(
  url: string,
  options: RequestInit = {},
  timeout = 20000
): Promise<Response> {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        "User-Agent": getRandomUserAgent(),
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Cache-Control": "no-cache",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "cross-site",
        "Sec-Fetch-User": "?1",
        "Upgrade-Insecure-Requests": "1",
        Connection: "keep-alive",
        ...options.headers,
      },
    })
    return response
  } finally {
    clearTimeout(id)
  }
}

// Enhanced metadata fetching with better retry logic and fallbacks
export async function fetchPageMetadata(url: string, retryCount = 4) {
  console.log(`[fetchPageMetadata] Starting metadata fetch for: ${url}`)

  // Normalize URL first
  let normalizedUrl = url
  try {
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      normalizedUrl = "https://" + url
    }
    new URL(normalizedUrl) // Validate URL
  } catch {
    console.error(`[fetchPageMetadata] Invalid URL: ${url}`)
    return {
      title: extractDomainTitle(url),
      description: "",
      image: "",
      favicon: getDefaultFavicon(url),
    }
  }

  // Check for special site handling
  const domain = new URL(normalizedUrl).hostname.toLowerCase()
  
  if (domain.includes('youtube.com') || domain.includes('youtu.be')) {
    console.log(`[fetchPageMetadata] Detected YouTube URL, using specialized extraction`)
    return await fetchYouTubeMetadata(normalizedUrl)
  }

  if (domain.includes('twitter.com') || domain.includes('x.com')) {
    console.log(`[fetchPageMetadata] Detected Twitter/X URL, using specialized extraction`)
    return await fetchTwitterMetadata(normalizedUrl)
  }

  for (let attempt = 1; attempt <= retryCount; attempt++) {
    try {
      console.log(`[fetchPageMetadata] Attempt ${attempt}/${retryCount} for: ${normalizedUrl}`)

      const response = await safeFetch(
        normalizedUrl,
        {
          redirect: "follow",
          method: "GET",
        },
        attempt === 1 ? 15000 : 25000 // Longer timeout for retries
      )

      const effectiveUrl = response.url || normalizedUrl
      console.log(
        `[fetchPageMetadata] Response status: ${response.status}, effective URL: ${effectiveUrl}`
      )

      if (!response.ok) {
        console.error(`[fetchPageMetadata] HTTP error: ${response.status} ${response.statusText}`)

        // For 4xx errors, try one more time with different headers
        if (response.status >= 400 && response.status < 500 && attempt === 1) {
          console.log(`[fetchPageMetadata] Client error, trying with different headers`)
          continue
        }

        if (attempt < retryCount) {
          console.log(`[fetchPageMetadata] Retrying... (attempt ${attempt + 1}/${retryCount})`)
          await new Promise((resolve) => setTimeout(resolve, 2000 * attempt))
          continue
        }

        return {
          title: extractDomainTitle(effectiveUrl),
          description: "",
          image: "",
          favicon: getDefaultFavicon(effectiveUrl),
        }
      }

      const contentType = response.headers.get("content-type") || ""
      console.log(`[fetchPageMetadata] Content-Type: ${contentType}`)

      if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
        console.warn(`[fetchPageMetadata] Non-HTML content type: ${contentType}`)
        return {
          title: extractDomainTitle(effectiveUrl),
          description: "",
          image: "",
          favicon: getDefaultFavicon(effectiveUrl),
        }
      }

      const html = await response.text()

      if (!html || html.trim().length === 0) {
        console.error(`[fetchPageMetadata] Empty HTML response`)
        if (attempt < retryCount) {
          await new Promise((resolve) => setTimeout(resolve, 2000 * attempt))
          continue
        }
        return {
          title: extractDomainTitle(effectiveUrl),
          description: "",
          image: "",
          favicon: getDefaultFavicon(effectiveUrl),
        }
      }

      console.log(`[fetchPageMetadata] HTML length: ${html.length}`)
      const metadata = parseHtmlMetadata(html, effectiveUrl)

      // Enhanced validation - check if we got meaningful metadata
      const isGoodMetadata = 
        metadata.title && 
        metadata.title.length > 3 &&
        metadata.title !== extractDomainTitle(effectiveUrl) &&
        !metadata.title.toLowerCase().includes('error') &&
        !metadata.title.toLowerCase().includes('not found')

      if (!isGoodMetadata && attempt < retryCount) {
        console.log(`[fetchPageMetadata] Poor metadata quality, retrying with delay...`)
        await new Promise((resolve) => setTimeout(resolve, 3000 * attempt))
        continue
      }

      console.log(`[fetchPageMetadata] Successfully extracted metadata:`, {
        title: metadata.title,
        description: metadata.description ? metadata.description.substring(0, 100) + '...' : 'none',
        hasImage: !!metadata.image,
        hasFavicon: !!metadata.favicon
      })

      return metadata
    } catch (err) {
      console.error(`[fetchPageMetadata] Attempt ${attempt} failed for ${normalizedUrl}:`, err)

      if (attempt < retryCount) {
        const delay = Math.min(5000, 2000 * attempt)
        console.log(`[fetchPageMetadata] Waiting ${delay}ms before retry...`)
        await new Promise((resolve) => setTimeout(resolve, delay))
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

  console.log(`[parseHtmlMetadata] Parsing HTML for metadata`)

  try {
    const $ = cheerio.load(html, {
      xmlMode: false,
      lowerCaseAttributeNames: false,
    })

    // Enhanced title extraction with priority order
    title =
      $('meta[property="og:title"]').attr("content") ||
      $('meta[name="twitter:title"]').attr("content") ||
      $('meta[property="twitter:title"]').attr("content") ||
      $('title').first().text().trim() ||
      $('h1').first().text().trim() ||
      ""

    // Enhanced description extraction
    description =
      $('meta[property="og:description"]').attr("content") ||
      $('meta[name="description"]').attr("content") ||
      $('meta[name="twitter:description"]').attr("content") ||
      $('meta[property="twitter:description"]').attr("content") ||
      $('meta[itemprop="description"]').attr("content") ||
      ""

    // Enhanced image extraction
    image =
      $('meta[property="og:image"]').attr("content") ||
      $('meta[property="og:image:url"]').attr("content") ||
      $('meta[name="twitter:image"]').attr("content") ||
      $('meta[property="twitter:image"]').attr("content") ||
      $('meta[name="twitter:image:src"]').attr("content") ||
      $('link[rel="image_src"]').attr("href") ||
      $('meta[itemprop="image"]').attr("content") ||
      ""

    // Enhanced favicon extraction
    favicon =
      $('link[rel="icon"]').last().attr("href") ||
      $('link[rel="shortcut icon"]').attr("href") ||
      $('link[rel="apple-touch-icon"]').last().attr("href") ||
      $('link[rel="apple-touch-icon-precomposed"]').last().attr("href") ||
      ""

    console.log(`[parseHtmlMetadata] Raw extracted:`, {
      title: title ? `${title.substring(0, 50)}...` : "none",
      description: description ? `${description.substring(0, 50)}...` : "none",
      image: image ? `${image.substring(0, 50)}...` : "none",
      favicon: favicon ? `${favicon.substring(0, 50)}...` : "none",
    })

    // Resolve relative URLs
    const baseUrl = new URL(effectiveUrl)

    if (image && !image.startsWith("http") && !image.startsWith("//")) {
      try {
        image = new URL(image, baseUrl.origin).toString()
      } catch {
        console.warn(`[parseHtmlMetadata] Failed to resolve image URL: ${image}`)
        image = ""
      }
    } else if (image && image.startsWith("//")) {
      image = baseUrl.protocol + image
    }

    if (favicon && !favicon.startsWith("http") && !favicon.startsWith("//")) {
      try {
        favicon = new URL(favicon, baseUrl.origin).toString()
      } catch {
        console.warn(`[parseHtmlMetadata] Failed to resolve favicon URL: ${favicon}`)
        favicon = ""
      }
    } else if (favicon && favicon.startsWith("//")) {
      favicon = baseUrl.protocol + favicon
    }

    // Clean up values
    title = title.replace(/\s+/g, " ").trim()
    description = description.replace(/\s+/g, " ").trim()

    // Remove common suffixes
    const titleCleanupPatterns = [
      / - YouTube$/,
      / \| YouTube$/,
      / - Twitter$/,
      / on Twitter$/,
      / \| Facebook$/,
      / - Facebook$/,
    ]
    for (const pattern of titleCleanupPatterns) {
      title = title.replace(pattern, "").trim()
    }

    if (!title || title.length < 3) {
      title = extractDomainTitle(effectiveUrl)
    }

    if (!favicon) {
      favicon = getDefaultFavicon(effectiveUrl)
    }

    console.log(`[parseHtmlMetadata] Final parsed:`, {
      title: title ? `${title.substring(0, 50)}...` : "none",
      description: description ? `${description.substring(0, 50)}...` : "none",
      image: image ? `${image.substring(0, 50)}...` : "none",
      favicon: favicon ? `${favicon.substring(0, 50)}...` : "none",
    })
  } catch (err) {
    console.error(`[parseHtmlMetadata] Error parsing HTML:`, err)
    title = extractDomainTitle(effectiveUrl)
    favicon = getDefaultFavicon(effectiveUrl)
  }

  return { title, description, image, favicon }
}


// Enhanced YouTube metadata extraction
async function fetchYouTubeMetadata(url: string) {
  console.log(`[fetchYouTubeMetadata] Starting YouTube metadata extraction for: ${url}`)

  const videoId = extractYouTubeVideoId(url)
  if (!videoId) {
    console.error(`[fetchYouTubeMetadata] Could not extract video ID from: ${url}`)
    return {
      title: "YouTube Video",
      description: "",
      image: `https://img.youtube.com/vi/default/maxresdefault.jpg`,
      favicon: "https://www.youtube.com/s/desktop/12d6b690/img/favicon_32x32.png",
    }
  }

  console.log(`[fetchYouTubeMetadata] Extracted video ID: ${videoId}`)

  // Multiple strategies for YouTube metadata
  const strategies = [
    () => fetchYouTubeOEmbed(videoId),
    () => fetchYouTubePageScraping(videoId),
    () => fetchYouTubeNoembed(videoId),
  ]

  for (const strategy of strategies) {
    try {
      const result = await strategy()
      if (result && result.title && result.title !== "YouTube Video") {
        console.log(`[fetchYouTubeMetadata] Successfully got metadata using strategy`)
        return result
      }
    } catch (error) {
      console.error(`[fetchYouTubeMetadata] Strategy failed:`, error)
    }
  }

  // Final fallback
  return {
    title: "YouTube Video",
    description: "",
    image: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
    favicon: "https://www.youtube.com/s/desktop/12d6b690/img/favicon_32x32.png",
  }
}

async function fetchYouTubeOEmbed(videoId: string) {
  const oEmbedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
  console.log(`[fetchYouTubeOEmbed] Trying oEmbed API: ${oEmbedUrl}`)

  const response = await safeFetch(oEmbedUrl, {}, 10000)

  if (response.ok) {
    const data = await response.json()
    console.log(`[fetchYouTubeOEmbed] oEmbed response:`, {
      title: data.title,
      hasThumbnail: !!data.thumbnail_url,
      author: data.author_name,
    })

    return {
      title: data.title || "YouTube Video",
      description: data.author_name ? `By ${data.author_name}` : "",
      image: data.thumbnail_url || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
      favicon: "https://www.youtube.com/s/desktop/12d6b690/img/favicon_32x32.png",
    }
  }
  
  throw new Error('oEmbed failed')
}

async function fetchYouTubePageScraping(videoId: string) {
  console.log(`[fetchYouTubePageScraping] Scraping YouTube page`)
  
  const response = await safeFetch(
    `https://www.youtube.com/watch?v=${videoId}`,
    {
      headers: {
        "Accept-Language": "en-US,en;q=0.9",
      },
    },
    20000
  )

  if (response.ok) {
    const html = await response.text()
    const $ = cheerio.load(html)

    const title =
      $('meta[property="og:title"]').attr("content") ||
      $('meta[name="title"]').attr("content") ||
      $("title").text().replace(" - YouTube", "") ||
      "YouTube Video"

    let description =
      $('meta[property="og:description"]').attr("content") ||
      $('meta[name="description"]').attr("content") ||
      ""

    // Extract channel name from various possible locations
    const channelName =
      $('meta[itemprop="channelId"]').attr("content") ||
      $('link[itemprop="name"]').attr("content") ||
      ""

    // Clean up description
    if (description.includes("Enjoy the videos and music")) {
      description = description.split("Enjoy the videos and music")[0].trim()
    }
    
    if (channelName && !description.includes(channelName)) {
      description = `By ${channelName}${description ? ` - ${description}` : ""}`
    }

    return {
      title: title.replace(/\s+/g, " ").trim(),
      description: description.replace(/\s+/g, " ").trim(),
      image: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
      favicon: "https://www.youtube.com/s/desktop/12d6b690/img/favicon_32x32.png",
    }
  }
  
  throw new Error('Page scraping failed')
}

async function fetchYouTubeNoembed(videoId: string) {
  console.log(`[fetchYouTubeNoembed] Trying Noembed API`)
  
  const nEmbedUrl = `https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`
  
  const response = await safeFetch(nEmbedUrl, {}, 10000)
  
  if (response.ok) {
    const data = await response.json()
    if (data.title && !data.error) {
      return {
        title: data.title,
        description: data.author_name ? `By ${data.author_name}` : "",
        image: data.thumbnail_url || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
        favicon: "https://www.youtube.com/s/desktop/12d6b690/img/favicon_32x32.png",
      }
    }
  }
  
  throw new Error('Noembed failed')
}

// Twitter/X metadata extraction
async function fetchTwitterMetadata(url: string) {
  console.log(`[fetchTwitterMetadata] Extracting Twitter metadata for: ${url}`)
  
  try {
    const response = await safeFetch(url, {
      headers: {
        "Accept-Language": "en-US,en;q=0.9",
      },
    }, 15000)

    if (response.ok) {
      const html = await response.text()
      const metadata = parseHtmlMetadata(html, url)
      
      // Enhance with Twitter-specific logic
      if (!metadata.image) {
        metadata.favicon = "https://abs.twimg.com/favicons/twitter.ico"
      }
      
      return metadata
    }
  } catch (error) {
    console.error(`[fetchTwitterMetadata] Error:`, error)
  }

  return {
    title: "Post on X",
    description: "",
    image: "",
    favicon: "https://abs.twimg.com/favicons/twitter.ico",
  }
}

function extractYouTubeVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/,
    /youtube\.com\/watch\?v=([^&]+)/,
    /youtube\.com\/embed\/([^\/]+)/,
    /youtu\.be\/([^\/]+)/,
    /youtube\.com\/v\/([^\/]+)/,
  ]

  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match && match[1] && match[1].length === 11) {
      return match[1]
    }
  }

  return null
}

// Helper Functions
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