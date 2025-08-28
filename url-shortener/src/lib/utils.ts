import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import * as cheerio from "cheerio"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ---- Safe Fetch with Timeout ----
async function safeFetch(
  url: string,
  options: RequestInit = {},
  timeout = 10000
): Promise<Response> {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    })
    return response
  } finally {
    clearTimeout(id)
  }
}

// ---- General Page Metadata ----
export async function fetchPageMetadata(url: string) {
  console.log(`[fetchPageMetadata] Starting metadata fetch for: ${url}`)
  try {
    const isYouTube = url.includes("youtube.com") || url.includes("youtu.be")
    if (isYouTube) {
      console.log(`[fetchPageMetadata] Detected YouTube URL, using specialized extraction`)
      return await fetchYouTubeMetadata(url)
    }

    const response = await safeFetch(url, {
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
      },
    })

    const effectiveUrl = response.url || url

    if (!response.ok) {
      console.error(
        `[fetchPageMetadata] Failed to fetch ${url}: ${response.status} ${response.statusText}`
      )
      return { title: "Untitled", description: "", image: "", favicon: "" }
    }

    const html = await response.text()

    let title = ""
    let description = ""
    let image = ""
    let favicon = ""

    try {
      const $ = cheerio.load(html)

      title =
        $("meta[property='og:title']").attr("content") ||
        $("meta[name='twitter:title']").attr("content") ||
        $("title").text().trim() ||
        "Untitled"

      description =
        $("meta[property='og:description']").attr("content") ||
        $("meta[name='description']").attr("content") ||
        $("meta[name='twitter:description']").attr("content") ||
        ""

      image =
        $("meta[property='og:image']").attr("content") ||
        $("meta[name='twitter:image']").attr("content") ||
        ""

      favicon =
        $("link[rel='icon']").attr("href") ||
        $("link[rel='shortcut icon']").attr("href") ||
        $("link[rel='apple-touch-icon']").attr("href") ||
        ""
    } catch (e) {
      console.error("[fetchPageMetadata] Error parsing HTML:", e)
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
      try {
        const urlObj = new URL(effectiveUrl)
        favicon = `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=128`
      } catch {}
    }

    // Cleanup
    title = title.replace(/\s+/g, " ").trim()
    if (title.includes(" - YouTube")) {
      title = title.replace(" - YouTube", "")
    }

    description = description.replace(/\s+/g, " ").trim()

    console.log(`[fetchPageMetadata] Extracted metadata:`, {
      title,
      description: description ? `${description.substring(0, 50)}...` : "none",
    })

    return {
      title,
      description,
      image,
      favicon,
    }
  } catch (error) {
    console.error(`[fetchPageMetadata] Error fetching metadata for ${url}:`, error)
    return {
      title: "Untitled",
      description: "",
      image: "",
      favicon: "",
    }
  }
}

// ---- YouTube Metadata Extraction ----
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
      return { title: "YouTube Video", description: "", image: "", favicon: "https://www.youtube.com/favicon.ico" }
    }

    // Method 1: Direct scrape
    try {
      const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`
      const response = await safeFetch(youtubeUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      })

      if (response.ok) {
        const html = await response.text()
        const $ = cheerio.load(html)

        const title =
          $('meta[property="og:title"]').attr("content") ||
          $("title").text().replace(" - YouTube", "").trim() ||
          "YouTube Video"

        let description =
          $('meta[property="og:description"]').attr("content") ||
          $('meta[name="description"]').attr("content") ||
          ""

        if (!description || description.includes("Enjoy the videos")) {
          description = `Watch "${title}" on YouTube`
        }

        const imageUrl =
          $('meta[property="og:image"]').attr("content") ||
          `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`

        return {
          title,
          description,
          image: imageUrl,
          favicon: "https://www.youtube.com/favicon.ico",
        }
      }
    } catch {
      console.log("[fetchYouTubeMetadata] Direct scrape failed, trying oEmbed")
    }

    // Method 2: oEmbed
    try {
      const oEmbedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
      const response = await safeFetch(oEmbedUrl)

      if (response.ok) {
        const data = await response.json()
        const title = data.title || "YouTube Video"
        const thumbnailUrl = data.thumbnail_url || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`
        const authorName = data.author_name || "YouTube Creator"

        const description = `Video by ${authorName} on YouTube`

        return {
          title,
          description,
          image: thumbnailUrl,
          favicon: "https://www.youtube.com/favicon.ico",
        }
      }
    } catch {
      console.log("[fetchYouTubeMetadata] oEmbed failed")
    }

    // Final fallback
    return {
      title: "YouTube Video",
      description: "Watch this video on YouTube",
      image: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
      favicon: "https://www.youtube.com/favicon.ico",
    }
  } catch (error) {
    console.error("[fetchYouTubeMetadata] Error extracting YouTube metadata:", error)
    return { title: "YouTube Video", description: "", image: "", favicon: "https://www.youtube.com/favicon.ico" }
  }
}

// ---- YouTube Helpers ----
function getYouTubeVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/,
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