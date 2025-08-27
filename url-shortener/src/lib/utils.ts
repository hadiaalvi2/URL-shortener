import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import * as cheerio from "cheerio"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Simplified and more reliable metadata fetching
export async function fetchPageMetadata(url: string) {
  console.log(`[fetchPageMetadata] Starting fetch for: ${url}`);
  
  try {
    // Shorter timeout to prevent hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; URLShortener/1.0)",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`[fetchPageMetadata] HTTP ${response.status} for ${url}`);
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Simple, reliable metadata extraction
    const title = 
      $('meta[property="og:title"]').attr('content') ||
      $('meta[name="twitter:title"]').attr('content') ||
      $('title').first().text().trim() ||
      undefined;

    const description = 
      $('meta[property="og:description"]').attr('content') ||
      $('meta[name="twitter:description"]').attr('content') ||
      $('meta[name="description"]').attr('content') ||
      undefined;

    let image = 
      $('meta[property="og:image"]').attr('content') ||
      $('meta[name="twitter:image"]').attr('content') ||
      undefined;

    let favicon = 
      $('link[rel="icon"]').attr('href') ||
      $('link[rel="shortcut icon"]').attr('href') ||
      $('link[rel="apple-touch-icon"]').attr('href') ||
      undefined;

    // Resolve relative URLs
    const baseUrl = new URL(response.url || url);
    
    if (image && !image.startsWith('http')) {
      try {
        if (image.startsWith('//')) {
          image = `${baseUrl.protocol}${image}`;
        } else {
          image = new URL(image, baseUrl.origin).toString();
        }
      } catch {
        image = undefined;
      }
    }

    if (favicon && !favicon.startsWith('http')) {
      try {
        if (favicon.startsWith('//')) {
          favicon = `${baseUrl.protocol}${favicon}`;
        } else {
          favicon = new URL(favicon, baseUrl.origin).toString();
        }
      } catch {
        favicon = undefined;
      }
    }

    // Fallback favicon
    if (!favicon) {
      favicon = `https://www.google.com/s2/favicons?domain=${baseUrl.hostname}&sz=128`;
    }

    // YouTube-specific image fallback
    if (!image && (baseUrl.hostname.includes('youtube.com') || baseUrl.hostname === 'youtu.be')) {
      const videoId = baseUrl.searchParams.get('v') || 
                     (baseUrl.hostname === 'youtu.be' ? baseUrl.pathname.slice(1) : null);
      if (videoId) {
        image = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
      }
    }

    const metadata = {
      title: title || undefined,
      description: description || undefined,
      image: image || undefined,
      favicon: favicon || undefined,
    };

    console.log(`[fetchPageMetadata] Success for ${url}:`, metadata);
    return metadata;

  } catch (error) {
    console.error(`[fetchPageMetadata] Error for ${url}:`, error);
    
    // Return fallback metadata based on URL
    try {
      const urlObj = new URL(url);
      return {
        title: `Page from ${urlObj.hostname}`,
        description: `Content from ${urlObj.hostname}`,
        image: undefined,
        favicon: `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=128`,
      };
    } catch {
      return {
        title: undefined,
        description: undefined,
        image: undefined,
        favicon: undefined,
      };
    }
  }
}