import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import * as cheerio from "cheerio"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Enhanced User-Agent rotation
const userAgents = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1"
];

function getRandomUserAgent() {
  return userAgents[Math.floor(Math.random() * userAgents.length)];
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
        "User-Agent": getRandomUserAgent(),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
        "Sec-CH-UA": '"Not_A Brand";v="8", "Chromium";v="120"',
        "Sec-CH-UA-Mobile": "?0",
        "Sec-CH-UA-Platform": '"Windows"',
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
        "Upgrade-Insecure-Requests": "1",
        "Referer": "https://www.google.com/",
        "DNT": "1",
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

  // Check if this is a protected site that needs special handling
  const domain = extractDomain(url);
  const isProtectedSite = isProtectedDomain(domain);
  
  if (isProtectedSite) {
    console.log(`[fetchPageMetadata] Detected protected site: ${domain}, using enhanced fetching`);
    return await fetchProtectedSiteMetadata(url, retryCount);
  }

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

  for (let attempt = 1; attempt <= retryCount; attempt++) {
    try {
      console.log(`[fetchPageMetadata] Attempt ${attempt}/${retryCount} for: ${normalizedUrl}`)

      const isYouTube = normalizedUrl.includes("youtube.com") || normalizedUrl.includes("youtu.be")
      if (isYouTube) {
        console.log(`[fetchPageMetadata] Detected YouTube URL, using specialized extraction`)
        return await fetchYouTubeMetadata(normalizedUrl)
      }

      // Add delay between retries (exponential backoff)
      if (attempt > 1) {
        const delay = Math.min(2000 * Math.pow(2, attempt - 1), 10000);
        console.log(`[fetchPageMetadata] Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      const response = await safeFetch(
        normalizedUrl,
        {
          redirect: "follow",
          method: "GET",
        },
        20000 // Increased timeout for complex sites
      )

      const effectiveUrl = response.url || normalizedUrl
      console.log(
        `[fetchPageMetadata] Response status: ${response.status}, effective URL: ${effectiveUrl}`
      )

      if (!response.ok) {
        console.error(`[fetchPageMetadata] HTTP error: ${response.status} ${response.statusText}`)

        // For 4xx errors, don't retry
        if (response.status >= 400 && response.status < 500 && attempt < retryCount) {
          console.log(`[fetchPageMetadata] Client error, skipping retries`)
          break
        }

        if (attempt < retryCount) {
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

      // Validate that we got meaningful metadata
      if (!metadata.title || metadata.title === extractDomainTitle(effectiveUrl)) {
        if (attempt < retryCount) {
          console.log(`[fetchPageMetadata] Poor metadata quality, retrying...`)
          continue
        }
      }

      return metadata
    } catch (err) {
      console.error(`[fetchPageMetadata] Attempt ${attempt} failed for ${normalizedUrl}:`, err)

      if (attempt < retryCount) {
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

// Special handling for protected sites (Adidas, Lacoste, etc.)
async function fetchProtectedSiteMetadata(url: string, retryCount = 3) {
  for (let attempt = 1; attempt <= retryCount; attempt++) {
    try {
      console.log(`[fetchProtectedSiteMetadata] Attempt ${attempt}/${retryCount} for protected site: ${url}`)
      
      // Add delay between retries
      if (attempt > 1) {
        const delay = 2000 * attempt;
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      // Try with different strategies for each attempt
      let response: Response;
      
      if (attempt === 1) {
        // First attempt: Standard headers
        response = await safeFetch(url, {
          redirect: "follow",
          method: "GET",
        }, 25000);
      } else if (attempt === 2) {
        // Second attempt: More aggressive headers
        response = await safeFetch(url, {
          redirect: "follow",
          method: "GET",
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
            "Referer": "https://www.google.com/",
            "DNT": "1",
          }
        }, 25000);
      } else {
        // Third attempt: Minimal headers
        response = await safeFetch(url, {
          redirect: "follow",
          method: "GET",
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          }
        }, 25000);
      }

      if (response.ok) {
        const html = await response.text();
        const metadata = parseHtmlMetadata(html, response.url || url);
        
        // Validate we got good metadata
        if (metadata.title && metadata.title !== extractDomainTitle(url)) {
          return metadata;
        }
      }
      
    } catch (error) {
      console.error(`[fetchProtectedSiteMetadata] Attempt ${attempt} failed:`, error);
    }
  }

  // Final fallback for protected sites
  return {
    title: extractDomainTitle(url),
    description: "",
    image: "",
    favicon: getDefaultFavicon(url),
  };
}

function isProtectedDomain(domain: string): boolean {
  const protectedDomains = [
    'adidas', 'lacoste', 'liverpoolfc', 'nike', 'amazon', 'bestbuy',
    'walmart', 'target', 'zara', 'hm', 'apple', 'microsoft'
  ];
  
  return protectedDomains.some(protectedDomain => domain.includes(protectedDomain));
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function parseHtmlMetadata(html: string, effectiveUrl: string) {
  let title = ""
  let description = ""
  let image = ""
  let favicon = ""

  console.log(`[parseHtmlMetadata] Parsing HTML for metadata`)

  try {
    const $ = cheerio.load(html)

    // Extract title - try multiple sources
    title =
      $('meta[property="og:title"]').attr("content") ||
      $('meta[name="twitter:title"]').attr("content") ||
      $("title").first().text().trim() ||
      $('h1').first().text().trim() ||
      ""

    // Extract description
    description =
      $('meta[property="og:description"]').attr("content") ||
      $('meta[name="description"]').attr("content") ||
      $('meta[name="twitter:description"]').attr("content") ||
      ""

    // Extract image - prioritize social media images
    image =
      $('meta[property="og:image"]').attr("content") ||
      $('meta[name="twitter:image:src"]').attr("content") ||
      $('meta[name="twitter:image"]').attr("content") ||
      $('link[rel="image_src"]').attr("href") ||
      ""

    // Extract favicon
    favicon =
      $('link[rel="icon"]').attr("href") ||
      $('link[rel="shortcut icon"]').attr("href") ||
      $('link[rel="apple-touch-icon"]').attr("href") ||
      $('link[rel="apple-touch-icon-precomposed"]').attr("href") ||
      $('meta[itemprop="image"]').attr("content") ||
      ""

    console.log(`[parseHtmlMetadata] Raw extracted:`, {
      title: title ? `${title.substring(0, 50)}...` : "none",
      description: description ? `${description.substring(0, 50)}...` : "none",
      image: image ? `${image.substring(0, 50)}...` : "none",
      favicon: favicon ? `${favicon.substring(0, 50)}...` : "none",
    })

    // Resolve relative URLs
    const baseUrl = new URL(effectiveUrl)

    if (image && !image.startsWith("http")) {
      try {
        image = new URL(image, baseUrl.origin).toString()
      } catch {
        image = ""
      }
    }

    if (favicon && !favicon.startsWith("http")) {
      try {
        favicon = new URL(favicon, baseUrl.origin).toString()
      } catch {
        favicon = ""
      }
    }

    // Clean up the extracted values
    title = title.replace(/\s+/g, " ").trim().substring(0, 200)
    description = description.replace(/\s+/g, " ").trim().substring(0, 300)

    // Fallback to domain title if title is empty
    if (!title) {
      title = extractDomainTitle(effectiveUrl)
    }

    // Fallback to default favicon if none found
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

// ---- YouTube Specific Metadata ----
async function fetchYouTubeMetadata(url: string) {
  console.log(`[fetchYouTubeMetadata] Starting YouTube metadata extraction for: ${url}`)

  const videoId = extractYouTubeVideoId(url)
  if (!videoId) {
    console.error(`[fetchYouTubeMetadata] Could not extract video ID from: ${url}`)
    return {
      title: "YouTube Video",
      description: "",
      image: "",
      favicon: "https://www.youtube.com/favicon.ico",
    }
  }

  console.log(`[fetchYouTubeMetadata] Extracted video ID: ${videoId}`)

  // Try to fetch from oEmbed API first
  try {
    const oEmbedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
    console.log(`[fetchYouTubeMetadata] Trying oEmbed API: ${oEmbedUrl}`)

    const response = await safeFetch(oEmbedUrl, {}, 10000)

    if (response.ok) {
      const data = await response.json()
      console.log(`[fetchYouTubeMetadata] oEmbed response:`, {
        title: data.title,
        hasThumbnail: !!data.thumbnail_url,
        author: data.author_name,
      })

      return {
        title: data.title || "YouTube Video",
        description: data.author_name ? `By ${data.author_name}` : "",
        image: data.thumbnail_url || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
        favicon: "https://www.youtube.com/favicon.ico",
      }
    }
  } catch (oEmbedError) {
    console.error(`[fetchYouTubeMetadata] oEmbed API failed:`, oEmbedError)
  }

  // Fallback to scraping the page
  try {
    console.log(`[fetchYouTubeMetadata] Falling back to page scraping`)
    const response = await safeFetch(
      `https://www.youtube.com/watch?v=${videoId}`,
      {
        headers: {
          "Accept-Language": "en-US,en;q=0.9",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      },
      15000
    )

    if (response.ok) {
      const html = await response.text()
      const $ = cheerio.load(html)

      const title =
        $('meta[property="og:title"]').attr("content") ||
        $("title").text().replace(" - YouTube", "") ||
        "YouTube Video"

      let description =
        $('meta[property="og:description"]').attr("content") ||
        $('meta[name="description"]').attr("content") ||
        ""

      const channelName =
        $('link[itemprop="name"]').attr("content") ||
        $('span[itemprop="author"] link[itemprop="name"]').attr("content") ||
        $(".ytd-channel-name a").text().trim() ||
        ""

      if (channelName && !description.includes(channelName)) {
        description = channelName + (description ? ` - ${description}` : "")
      }

      if (description.includes("Enjoy the videos and music")) {
        description = description.split("Enjoy the videos and music")[0].trim()
      }

      return {
        title: title.replace(/\s+/g, " ").trim(),
        description: description.replace(/\s+/g, " ").trim(),
        image: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
        favicon: "https://www.youtube.com/favicon.ico",
      }
    }
  } catch (scrapeError) {
    console.error(`[fetchYouTubeMetadata] Page scraping also failed:`, scrapeError)
  }

  // Final fallback - minimal metadata
  console.log(`[fetchYouTubeMetadata] Using minimal fallback metadata`)
  return {
    title: "YouTube Video",
    description: "",
    image: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
    favicon: "https://www.youtube.com/favicon.ico",
  }
}

function extractYouTubeVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:membed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/,
    /youtube\.com\/watch\?v=([^&]+)/,
    /youtube\.com\/embed\/([^\/]+)/,
    /youtu\.be\/([^\/]+)/,
  ]

  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match && match[1]) {
      return match[1]
    }
  }

  return null
}

// ---- Helper Functions ----
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