import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import * as cheerio from "cheerio"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export async function fetchYouTubeMetadata(url: string): Promise<{
  title?: string;
  description?: string;
  image?: string;
  favicon?: string;
}> {
  try {
    const parsedUrl = new URL(url);
    
    // Extract video ID from different YouTube URL formats
    let videoId: string | null = null;
    if (parsedUrl.hostname.includes('youtube.com')) {
      videoId = parsedUrl.searchParams.get('v');
    } else if (parsedUrl.hostname === 'youtu.be') {
      videoId = parsedUrl.pathname.slice(1);
    }
    
    if (!videoId) {
      throw new Error('Invalid YouTube URL - no video ID found');
    }
    
    console.log(`[fetchYouTubeMetadata] Extracting metadata for video ID: ${videoId}`);
    
    // Method 1: Try oEmbed API (official but limited)
    try {
      const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
      const oembedResponse = await fetch(oembedUrl);
      
      if (oembedResponse.ok) {
        const oembedData = await oembedResponse.json();
        // oEmbed doesn't provide description, so we'll scrape for it
        const scrapedDescription = await scrapeYouTubeDescription(url);
        
        return {
          title: oembedData.title,
          description: scrapedDescription,
          image: oembedData.thumbnail_url || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
          favicon: 'https://www.youtube.com/favicon.ico'
        };
      }
    } catch (oembedError) {
      console.error('oEmbed method failed:', oembedError);
    }
    
    // Method 2: Fallback to page scraping
    return await scrapeYouTubePage(url, videoId);
    
  } catch (error) {
    console.error('Error in fetchYouTubeMetadata:', error);
    return {};
  }
}

async function scrapeYouTubeDescription(url: string): Promise<string | undefined> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });
    
    if (!response.ok) return undefined;
    
    const html = await response.text();
    
    // Multiple patterns to extract description, ordered by reliability
    const patterns = [
      // Primary patterns for video description
      /"videoDetails":\s*{[^{}]*"shortDescription":"([^"]*(?:\\.[^"]*)*)"/,
      /"shortDescription":"([^"]*(?:\\.[^"]*)*)"/,
      // Fallback patterns
      /"description":\s*{[^{}]*"simpleText":"([^"]*(?:\\.[^"]*)*)"/,
      /"description":"([^"]*(?:\\.[^"]*)*)"/,
      // Meta tag fallback
      /<meta property="og:description" content="([^"]+)"/,
      /<meta name="description" content="([^"]+)"/
    ];
    
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        let description = decodeYouTubeString(match[1]).trim();
        
        // Filter out generic descriptions and ensure minimum quality
        if (!isGenericYouTubeDescription(description) && description.length >= 20) {
          // Truncate very long descriptions for preview
          if (description.length > 300) {
            description = description.substring(0, 297) + '...';
          }
          return description;
        }
      }
    }
    
    return undefined;
  } catch (error) {
    console.error('Error scraping YouTube description:', error);
    return undefined;
  }
}

async function scrapeYouTubePage(url: string, videoId: string): Promise<{
  title?: string;
  description?: string;
  image?: string;
  favicon?: string;
}> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });
    
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const html = await response.text();
    
    // Extract title with priority order
    let title = extractMetaContent(html, /"videoDetails":\s*{[^{}]*"title":"([^"]*(?:\\.[^"]*)*)"/) ||
               extractMetaContent(html, /"title":"([^"]*(?:\\.[^"]*)*)"/) ||
               extractMetaContent(html, /<meta property="og:title" content="([^"]+)"/) ||
               extractMetaContent(html, /<title>([^<]+)<\/title>/);
    
    // Extract description using the same function as scrapeYouTubeDescription
    const description = await scrapeYouTubeDescription(url);
    
    // Clean up title
    if (title) {
      title = decodeYouTubeString(title).replace(/ - YouTube$/, '').trim();
    }
    
    return {
      title,
      description,
      image: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
      favicon: 'https://www.youtube.com/favicon.ico'
    };
    
  } catch (error) {
    console.error('Error scraping YouTube page:', error);
    return {
      image: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
      favicon: 'https://www.youtube.com/favicon.ico'
    };
  }
}

function extractMetaContent(html: string, pattern: RegExp): string | undefined {
  const match = html.match(pattern);
  return match ? match[1] : undefined;
}

function decodeYouTubeString(str: string): string {
  return str
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\')
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, code) => 
      String.fromCharCode(parseInt(code, 16))
    );
}

function isGenericYouTubeDescription(description: string): boolean {
  if (!description || description.length < 10) return true;
  
  const generic = [
    'enjoy the videos and music you love',
    'upload original content',
    'share it all with friends',
    'created using youtube',
    'this video is unavailable',
    'video unavailable',
    'private video',
    'deleted video',
    'watch this video on youtube',
    'subscribe to our channel',
    'like and subscribe'
  ];
  
  const lowerDesc = description.toLowerCase().trim();
  return generic.some(pattern => lowerDesc.includes(pattern));
}

export async function fetchPageMetadata(url: string) {
  console.log(`[fetchPageMetadata] Starting metadata fetch for: ${url}`);
  
  // Check if it's a YouTube URL and use specialized extraction
  try {
    const parsedUrl = new URL(url);
    const isYouTube = parsedUrl.hostname.includes('youtube.com') || parsedUrl.hostname === 'youtu.be';
    
    if (isYouTube) {
      console.log(`[fetchPageMetadata] Detected YouTube URL, using specialized extraction`);
      const youtubeMetadata = await fetchYouTubeMetadata(url);
      if (youtubeMetadata.title || youtubeMetadata.description) {
        console.log(`[fetchPageMetadata] Successfully extracted YouTube metadata:`, youtubeMetadata);
        return youtubeMetadata;
      }
    }
  } catch (urlError) {
    console.error('Error parsing URL for YouTube detection:', urlError);
  }
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // Increased timeout to 10 seconds

    console.log(`[fetchPageMetadata] Fetching response for: ${url}`); // Debugging line
    
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      cache: "no-store",
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
    const effectiveUrl = response.url || url; // final URL after redirects

    if (!response.ok) {
      const errorHtml = await response.text();
      console.error(`[fetchPageMetadata] Failed to fetch ${url}: ${response.status} ${response.statusText}. HTML response: ${errorHtml.substring(0, 500)}`);
    }

    const html = response.ok ? await response.text() : "";
    console.log(`[fetchPageMetadata] Fetched HTML for ${url}:`, html.substring(0, 500)); // Log first 500 characters of HTML
    
    let title: string | undefined;
    let description: string | undefined;
    let image: string | undefined;
    let favicon: string | undefined;

    try {
      const $ = cheerio.load(html);
      console.log(`[fetchPageMetadata] Cheerio loaded HTML for ${url}.`);

      const readMeta = (selectors: string[]): string | undefined => {
        for (const sel of selectors) {
          const val = $(sel).attr("content") || $(sel).attr("href");
          if (val && typeof val === "string" && val.trim().length > 0) return val.trim();
        }
        return undefined;
      };

      title =
        $("head title").text().trim() ||
        readMeta([
          "meta[property='og:title']",
          "meta[name='og:title']",
          "meta[name='twitter:title']",
          "meta[itemprop='name']",
        ]);

      description =
        readMeta([
          "meta[name='description']",
          "meta[property='og:description']",
          "meta[name='og:description']",
          "meta[name='twitter:description']",
          "meta[itemprop='description']",
        ]);

      const candidateImageSelectors = [
        "meta[property='og:image']",
        "meta[property='og:image:url']",
        "meta[property='og:image:secure_url']",
        "meta[name='og:image']",
        "meta[name='og:image:url']",
        "meta[name='og:image:secure_url']",
        "meta[name='twitter:image']",
        "meta[name='twitter:image:src']",
        "link[rel='image_src']",
        "meta[itemprop='image']",
      ];
      const candidates: string[] = [];
      for (const sel of candidateImageSelectors) {
        $(sel).each((_i, el) => {
          const v = $(el).attr("content") || $(el).attr("href");
          if (v && !candidates.includes(v)) candidates.push(v);
        });
      }
      image = candidates.find(Boolean);

      // Attempt to extract metadata from JSON-LD (handles arrays and @graph)
      const pickImageFromLd = (img: unknown): string | undefined => {
        if (img == null) return undefined;
        if (typeof img === 'string') return img;
        if (Array.isArray(img)) {
          for (const it of img) {
            const got = pickImageFromLd(it);
            if (got) return got;
          }
          return undefined;
        }
        if (typeof img === 'object') {
          const obj = img as { url?: string; contentUrl?: string; secure_url?: string; secureUrl?: string };
          return obj.url || obj.contentUrl || obj.secure_url || obj.secureUrl || undefined;
        }
        return undefined;
      };

      const considerLdNode = (node: unknown) => {
        if (!node || typeof node !== 'object') return;
        const obj = node as Record<string, unknown>;
        const type = obj['@type'] as string | undefined;
        if (type === 'WebPage' || type === 'Product' || type === 'Article' || type === 'NewsArticle') {
          if (!title) title = (obj.name as string) || (obj.headline as string) || (obj.alternativeHeadline as string) || (obj.url as string);
          if (!description) description = obj.description as string | undefined;
          if (!image) image = pickImageFromLd(obj.image);
        }
      };

      $('script[type="application/ld+json"]').each((_idx, el) => {
        try {
          const text = $(el).text();
          if (!text) return;
          const ldJson = JSON.parse(text);
          console.log('[fetchPageMetadata] Found JSON-LD');

          if (Array.isArray(ldJson)) {
            for (const item of ldJson) considerLdNode(item);
          } else if (ldJson && typeof ldJson === 'object') {
            if (Array.isArray(ldJson['@graph'])) {
              for (const item of ldJson['@graph']) considerLdNode(item);
            }
            considerLdNode(ldJson);
          }
        } catch (e) {
          console.error('[fetchPageMetadata] Error parsing JSON-LD:', e);
        }
      });

      // Try all common rel attributes for favicon
      favicon =
        $("link[rel='icon']").attr("href") ||
        $("link[rel='shortcut icon']").attr("href") ||
        $("link[rel='apple-touch-icon']").attr("href") ||
        $("link[rel='apple-touch-icon-precomposed']").attr("href");

    } catch (e) {
        console.error('[fetchPageMetadata] Error loading HTML with Cheerio or parsing meta tags:', e);
    }

    try {
      const baseUrl = new URL(effectiveUrl);
      // Resolve image URL
      if (image) {
        try {
          if (image.startsWith("//")) {
            image = `${baseUrl.protocol}${image}`;
          } else if (!image.startsWith("http")) {
            image = new URL(image, baseUrl.origin).toString();
          }
        } catch (e) {
          console.error('[fetchPageMetadata] Error resolving image URL:', e);
          image = undefined;
        }
      }

      if (favicon) {
        try {
          if (favicon.startsWith("//")) {
            // protocol-relative URL
            favicon = `${baseUrl.protocol}${favicon}`;
          } else if (!favicon.startsWith("http")) {
            // relative URL
            favicon = new URL(favicon, baseUrl.origin).toString();
          }
        } catch (e) {
          console.error('[fetchPageMetadata] Error resolving favicon URL:', e);
          favicon = undefined;
        }
      }
    } catch (e) {
      console.error('[fetchPageMetadata] Error creating base URL:', e);
      title = title || undefined;
      description = description || undefined;
      image = undefined;
      favicon = undefined;
    }

    // If critical data is missing or the first fetch failed, try a fallback via Jina reader
    if ((!title && !description && !image) || !response.ok || !html) {
      try {
        const u = new URL(url);
        const proto = u.protocol.replace(':',''); // 'http' or 'https'
        const jinaUrl = `https://r.jina.ai/${proto}://${u.host}${u.pathname}${u.search}`;
        console.log(`[fetchPageMetadata] Attempting fallback fetch via Jina reader: ${jinaUrl}`);
        const fallbackRes = await fetch(jinaUrl, { cache: "no-store" });
        if (fallbackRes.ok) {
          const fallbackHtml = await fallbackRes.text();
          const $fb = cheerio.load(fallbackHtml);
          const fbTitle = $fb("head title").text().trim() || $fb("meta[property='og:title']").attr("content");
          const fbDesc =
            $fb("meta[name='description']").attr("content") ||
            $fb("meta[property='og:description']").attr("content");
          const fbImg =
            $fb("meta[property='og:image']").attr("content") ||
            $fb("img").first().attr("src");
          title = title || fbTitle;
          description = description || fbDesc;
          image = image || fbImg;
        } else {
          console.warn(`[fetchPageMetadata] Jina fallback failed: ${fallbackRes.status} ${fallbackRes.statusText}`);
        }
      } catch (fallbackError) {
        console.warn('[fetchPageMetadata] Error during fallback extraction:', fallbackError);
      }
    }

    // Final pass: provide a sensible favicon fallback via Google S2 service
    try {
      const baseForFavicon = new URL(url);
      if (!favicon) {
        favicon = `https://www.google.com/s2/favicons?domain=${baseForFavicon.hostname}&sz=128`;
      }
    } catch {}

    const metadata = {
      title: title || undefined,
      description: description || undefined,
      image: image || undefined,
      favicon: favicon || undefined,
    };
    console.log(`[fetchPageMetadata] Successfully extracted metadata for ${url}:`, metadata); // Debugging line
    return metadata;
  } catch (error) {
    console.error(`[fetchPageMetadata] Error fetching metadata for ${url}:`, error);
    return {
      title: undefined,
      description: undefined,
      image: undefined,
      favicon: undefined,
    };
  }
}