import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import * as cheerio from "cheerio"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export async function fetchPageMetadata(url: string) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // Increased timeout to 10 seconds

    console.log(`Fetching metadata for: ${url}`); // Debugging line
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        // Some sites block requests without a user agent
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        Pragma: "no-cache",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
      return {
        title: undefined,
        description: undefined,
        image: undefined,
        favicon: undefined,
      };
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const title = $("head title").text().trim() || $("meta[property='og:title']").attr("content") || $("meta[name='twitter:title']").attr("content");
    const description =
      $("meta[name='description']").attr("content") ||
      $("meta[property='og:description']").attr("content") ||
      $("meta[name='twitter:description']").attr("content") ||
      $("meta[itemprop='description']").attr("content");
    let image =
      $("meta[property='og:image']").attr("content") ||
      $("meta[property='og:image:url']").attr("content") || // Added og:image:url
      $("meta[property='og:image:secure_url']").attr("content") || // Added og:image:secure_url
      $("meta[name='twitter:image']").attr("content") ||
      $("meta[name='twitter:image:src']").attr("content") ||
      $("link[rel='image_src']").attr("href") || // Add image_src link tag
      $("meta[itemprop='image']").attr("content"); // Add itemprop image

    // Try all common rel attributes for favicon
    let favicon =
      $("link[rel='icon']").attr("href") ||
      $("link[rel='shortcut icon']").attr("href") ||
      $("link[rel='apple-touch-icon']").attr("href") ||
      $("link[rel='apple-touch-icon-precomposed']").attr("href");

    try {
      const baseUrl = new URL(url);
      // Resolve image URL
      let resolvedImage = image; // Use a temporary variable for resolution
      if (resolvedImage) {
        if (resolvedImage.startsWith("//")) {
          resolvedImage = `${baseUrl.protocol}${resolvedImage}`;
        } else if (!resolvedImage.startsWith("http")) {
          resolvedImage = new URL(resolvedImage, baseUrl.origin).toString();
        }
      }
      image = resolvedImage; // Assign back to original image variable

      if (favicon) {
        if (favicon.startsWith("//")) {
          // protocol-relative URL
          favicon = `${baseUrl.protocol}${favicon}`;
        } else if (!favicon.startsWith("http")) {
          // relative URL
          favicon = new URL(favicon, baseUrl.origin).toString();
        }
      }
    } catch (e) {
      console.error("Error constructing URL for image or favicon:", e); // Updated error message
      favicon = undefined;
      image = undefined; // Also set image to undefined on error
    }

    const metadata = {
      title: title || undefined,
      description: description || undefined,
      image: image || undefined,
      favicon: favicon || undefined,
    };
    console.log(`Successfully extracted metadata for ${url}:`, metadata); // Debugging line
    return metadata;
  } catch (error) {
    console.error(`Error fetching metadata for ${url}:`, error);
    return {
      title: undefined,
      description: undefined,
      image: undefined,
      favicon: undefined,
    };
  }
}
