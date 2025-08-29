import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import * as cheerio from "cheerio";

interface MetadataResult {
  title?: string;
  description?: string;
  image?: string;
  favicon?: string;
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

async function safeFetch(
  url: string,
  options: RequestInit = {},
  timeout = 20000
): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        // More realistic user agent to avoid bot blocking
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
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
    });
    return response;
  } finally {
    clearTimeout(id);
  }
}

// Enhanced metadata extraction with multiple fallback strategies
export async function fetchPageMetadata(
  url: string,
  retryCount = 2
): Promise<MetadataResult> {
  console.log(`[fetchPageMetadata] Starting metadata fetch for: ${url}`);

  // Normalize URL first
  let normalizedUrl = url;
  try {
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      normalizedUrl = "https://" + url;
    }
    const urlObj = new URL(normalizedUrl);
    // Handle redirects for common patterns
    if (urlObj.hostname === "youtu.be") {
      const videoId = urlObj.pathname.slice(1).split("?")[0];
      normalizedUrl = `https://www.youtube.com/watch?v=${videoId}`;
    }
  } catch {
    console.error(`[fetchPageMetadata] Invalid URL: ${url}`);
    return getFallbackMetadata(url);
  }

  // Try multiple extraction methods
  const extractionMethods: Array<() => Promise<MetadataResult>> = [
    () => tryDirectScraping(normalizedUrl),
    () => tryWithDifferentUserAgent(normalizedUrl),
    () => tryMobileUserAgent(normalizedUrl),
  ];

  for (let method = 0; method < extractionMethods.length; method++) {
    for (let attempt = 1; attempt <= retryCount; attempt++) {
      try {
        console.log(
          `[fetchPageMetadata] Method ${method + 1}, Attempt ${attempt}/${retryCount} for: ${normalizedUrl}`
        );

        const metadata = await extractionMethods[method]();

        // Check if we got meaningful metadata
        if (isValidMetadata(metadata)) {
          console.log(`[fetchPageMetadata] Success with method ${method + 1}:`, {
            title: metadata.title?.substring(0, 50),
            description: metadata.description?.substring(0, 50),
            hasImage: Boolean(metadata.image),
            hasFavicon: Boolean(metadata.favicon),
          });
          return metadata;
        }

        console.log(
          `[fetchPageMetadata] Poor quality metadata from method ${method + 1}, trying next...`
        );
      } catch (err) {
        console.error(
          `[fetchPageMetadata] Method ${method + 1}, attempt ${attempt} failed:`,
          err
        );

        if (attempt < retryCount) {
          await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
        }
      }
    }
  }

  console.log(
    `[fetchPageMetadata] All methods failed, using fallback for: ${normalizedUrl}`
  );
  return getFallbackMetadata(normalizedUrl);
}

async function tryDirectScraping(url: string): Promise<MetadataResult> {
  const response = await safeFetch(url, { redirect: "follow" }, 20000);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const contentType = response.headers.get("content-type") || "";
  if (
    !contentType.includes("text/html") &&
    !contentType.includes("application/xhtml")
  ) {
    throw new Error(`Non-HTML content type: ${contentType}`);
  }

  const html = await response.text();
  if (!html || html.trim().length === 0) {
    throw new Error("Empty HTML response");
  }

  return parseHtmlMetadata(html, response.url || url);
}

async function tryWithDifferentUserAgent(url: string): Promise<MetadataResult> {
  const response = await safeFetch(
    url,
    {
      redirect: "follow",
      headers: {
        "User-Agent":
          "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    },
    20000
  );

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const html = await response.text();
  return parseHtmlMetadata(html, response.url || url);
}

async function tryMobileUserAgent(url: string): Promise<MetadataResult> {
  const response = await safeFetch(
    url,
    {
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
      },
    },
    20000
  );

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const html = await response.text();
  return parseHtmlMetadata(html, response.url || url);
}

function parseHtmlMetadata(html: string, effectiveUrl: string): MetadataResult {
  console.log(
    `[parseHtmlMetadata] Parsing HTML for metadata, URL: ${effectiveUrl}`
  );

  try {
    const $ = cheerio.load(html);

    // Enhanced title extraction
    let title =
      $('meta[property="og:title"]').attr("content")?.trim() ||
      $('meta[name="twitter:title"]').attr("content")?.trim() ||
      $('meta[property="twitter:title"]').attr("content")?.trim() ||
      $('meta[name="title"]').attr("content")?.trim() ||
      $("title").first().text()?.trim() ||
      $("h1").first().text()?.trim() ||
      "";

    // Enhanced description extraction
    let description =
      $('meta[property="og:description"]').attr("content")?.trim() ||
      $('meta[name="description"]').attr("content")?.trim() ||
      $('meta[name="twitter:description"]').attr("content")?.trim() ||
      $('meta[property="twitter:description"]').attr("content")?.trim() ||
      $('meta[name="abstract"]').attr("content")?.trim() ||
      "";

    // Enhanced image extraction
    let image =
      $('meta[property="og:image"]').attr("content")?.trim() ||
      $('meta[property="og:image:url"]').attr("content")?.trim() ||
      $('meta[name="twitter:image"]').attr("content")?.trim() ||
      $('meta[property="twitter:image"]').attr("content")?.trim() ||
      $('meta[name="twitter:image:src"]').attr("content")?.trim() ||
      $('link[rel="image_src"]').attr("href")?.trim() ||
      "";

    // Enhanced favicon extraction
    let favicon =
      $('link[rel="icon"]').attr("href")?.trim() ||
      $('link[rel="shortcut icon"]').attr("href")?.trim() ||
      $('link[rel="apple-touch-icon"]').attr("href")?.trim() ||
      $('link[rel="apple-touch-icon-precomposed"]').attr("href")?.trim() ||
      "";

    // Clean title and description
    if (title) {
      title = title.replace(/\s+/g, " ").trim();
      title = title
        .replace(/ - YouTube$/, "")
        .replace(/ \| [^|]+$/, "")
        .trim();
    }

    if (description) {
      description = description.replace(/\s+/g, " ").trim();
      if (description.includes("Enjoy the videos and music")) {
        description = description
          .split("Enjoy the videos and music")[0]
          .trim();
      }
    }

    // Resolve relative URLs
    const baseUrl = new URL(effectiveUrl);

    if (image && !image.startsWith("http")) {
      try {
        image = new URL(image, baseUrl.origin).toString();
      } catch {
        image = "";
      }
    }

    if (favicon && !favicon.startsWith("http")) {
      try {
        favicon = new URL(favicon, baseUrl.origin).toString();
      } catch {
        favicon = "";
      }
    }

    // YouTube handling
    if (
      effectiveUrl.includes("youtube.com") ||
      effectiveUrl.includes("youtu.be")
    ) {
      const videoId = extractYouTubeVideoId(effectiveUrl);
      if (videoId) {
        if (!image || image.includes("google.com/s2/favicons")) {
          image = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
        }
        if (!favicon) {
          favicon = "https://www.youtube.com/favicon.ico";
        }
      }
    }

    if (!title) {
      title = extractDomainTitle(effectiveUrl);
    }
    if (!favicon) {
      favicon = getDefaultFavicon(effectiveUrl);
    }

    const result = { title, description, image, favicon };

    console.log(`[parseHtmlMetadata] Extracted:`, {
      title:
        title?.substring(0, 50) +
        (title?.length && title.length > 50 ? "..." : ""),
      description:
        description?.substring(0, 50) +
        (description?.length && description.length > 50 ? "..." : ""),
      image: image ? "✓" : "✗",
      favicon: favicon ? "✓" : "✗",
    });

    return result;
  } catch (err) {
    console.error(`[parseHtmlMetadata] Error parsing HTML:`, err);
    return getFallbackMetadata(effectiveUrl);
  }
}

function isValidMetadata(metadata: MetadataResult): boolean {
  if (!metadata) return false;

  const hasGoodTitle =
    metadata.title !== undefined &&
    metadata.title.length > 3 &&
    !metadata.title.match(/^[A-Z][a-z]+( [A-Z][a-z]+)*$/);

  const hasGoodDescription =
    metadata.description !== undefined &&
    metadata.description.length > 10 &&
    !metadata.description.includes("Enjoy the videos and music");

  const hasGoodImage =
    metadata.image !== undefined &&
    !metadata.image.includes("google.com/s2/favicons");

  return hasGoodTitle || hasGoodDescription || hasGoodImage;
}

function getFallbackMetadata(url: string): MetadataResult {
  const title = extractDomainTitle(url);
  return {
    title,
    description: `Visit ${title}`,
    image: "",
    favicon: getDefaultFavicon(url),
  };
}

function extractYouTubeVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/,
    /youtube\.com\/watch\?v=([^&]+)/,
    /youtube\.com\/embed\/([^\/]+)/,
    /youtu\.be\/([^\/]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}

function extractDomainTitle(url: string): string {
  try {
    const domain = new URL(url).hostname;
    return domain
      .replace("www.", "")
      .replace(/\.[^.]+$/, "")
      .split(".")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  } catch {
    return "Website";
  }
}

function getDefaultFavicon(url: string): string {
  try {
    const urlObj = new URL(url);
    return `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=128`;
  } catch {
    return "/favicon.ico";
  }
}
