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
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
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

    const title = $("head title").text().trim();
    const description =
      $("meta[name='description']").attr("content") ||
      $("meta[property='og:description']").attr("content") ||
      $("meta[name='twitter:description']").attr("content") ||
      $("meta[itemprop='description']").attr("content") || // Added itemprop for description
      undefined;
    const image =
      $("meta[property='og:image']").attr("content") ||
      $("meta[name='twitter:image']").attr("content") ||
      undefined;

    // Try all common rel attributes for favicon
    let favicon =
      $("link[rel='icon']").attr("href") ||
      $("link[rel='shortcut icon']").attr("href") ||
      $("link[rel='apple-touch-icon']").attr("href") ||
      $("link[rel='apple-touch-icon-precomposed']").attr("href") ||
      undefined;

    try {
      const baseUrl = new URL(url);
      if (favicon) {
        if (favicon.startsWith("//")) {
          // protocol-relative URL
          favicon = `${baseUrl.protocol}${favicon}`;
        } else if (!favicon.startsWith("http")) {
          // relative URL
          favicon = new URL(favicon, baseUrl.origin).toString();
        }
      } else {
        // Fallback to default /favicon.ico
        favicon = `${baseUrl.origin}/favicon.ico`;
      }
    } catch (e) {
      console.error("Error constructing favicon URL:", e);
      favicon = undefined;
    }

    const metadata = {
      title: title || undefined,
      description,
      image,
      favicon,
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
