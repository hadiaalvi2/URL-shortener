import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import * as cheerio from "cheerio"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export async function fetchPageMetadata(url: string) {
  console.log(`[fetchPageMetadata] Starting metadata fetch for: ${url}`);
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    console.log(`[fetchPageMetadata] Fetching response for: ${url}`);
    
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      cache: "no-store",
      headers: {
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
    const effectiveUrl = response.url || url;

    if (!response.ok) {
      console.error(`[fetchPageMetadata] Failed to fetch ${url}: ${response.status} ${response.statusText}`);
    }

    const html = response.ok ? await response.text() : "";
    
    let title: string | undefined;
    let description: string | undefined;
    let image: string | undefined;
    let favicon: string | undefined;

    try {
      const $ = cheerio.load(html);

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

      // Special handling for YouTube
      const isYouTube = effectiveUrl.includes('youtube.com') || effectiveUrl.includes('youtu.be');
      if (isYouTube) {
        // Extract YouTube title more reliably
        const ytTitle = $("meta[property='og:title']").attr("content") || 
                        $("meta[name='twitter:title']").attr("content") ||
                        title;
        if (ytTitle && ytTitle !== title) {
          title = ytTitle;
        }

        // Extract YouTube description more reliably
        const ytDescription = $("meta[property='og:description']").attr("content") || 
                             $("meta[name='description']").attr("content") ||
                             $("meta[name='twitter:description']").attr("content") ||
                             description;
        
        // Filter out generic YouTube descriptions
        if (ytDescription && !ytDescription.includes("Enjoy the videos and music") && 
            !ytDescription.includes("Upload original content")) {
          description = ytDescription;
        }

        // Try to extract from JSON-LD for better description
        try {
          const jsonLdScript = $('script[type="application/ld+json"]').html();
          if (jsonLdScript) {
            const jsonLd = JSON.parse(jsonLdScript);
            if (jsonLd && jsonLd.description && !jsonLd.description.includes("Enjoy the videos")) {
              description = jsonLd.description;
            }
          }
        } catch (e) {
          console.log('Could not parse JSON-LD for YouTube');
        }
      }

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
      
      for (const sel of candidateImageSelectors) {
        const val = $(sel).attr("content") || $(sel).attr("href");
        if (val) {
          image = val;
          break;
        }
      }

      // YouTube thumbnail fallback
      if (isYouTube && !image) {
        const videoId = getYouTubeVideoId(effectiveUrl);
        if (videoId) {
          image = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
        }
      }

      // Try all common rel attributes for favicon
      favicon =
        $("link[rel='icon']").attr("href") ||
        $("link[rel='shortcut icon']").attr("href") ||
        $("link[rel='apple-touch-icon']").attr("href") ||
        $("link[rel='apple-touch-icon-precomposed']").attr("href");
    } catch (e) {
      console.error('[fetchPageMetadata] Error loading HTML with Cheerio:', e);
    }

    // Resolve relative URLs
    try {
      const baseUrl = new URL(effectiveUrl);
      
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
            favicon = `${baseUrl.protocol}${favicon}`;
          } else if (!favicon.startsWith("http")) {
            favicon = new URL(favicon, baseUrl.origin).toString();
          }
        } catch (e) {
          console.error('[fetchPageMetadata] Error resolving favicon URL:', e);
          favicon = undefined;
        }
      }
    } catch (e) {
      console.error('[fetchPageMetadata] Error creating base URL:', e);
    }

    // Final fallback for favicon
    if (!favicon) {
      try {
        const urlObj = new URL(url);
        favicon = `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=128`;
      } catch {}
    }

    // Clean up title and description
    if (title) {
      title = title.replace(/\s+/g, ' ').trim();
      // Remove YouTube suffix if present
      if (title.includes(' - YouTube')) {
        title = title.replace(' - YouTube', '');
      }
    }

    if (description) {
      description = description.replace(/\s+/g, ' ').trim();
      // Remove generic YouTube descriptions
      if (description.includes('Enjoy the videos and music you love')) {
        description = undefined;
      }
    }

    console.log(`[fetchPageMetadata] Extracted metadata for ${url}:`, {
      title: title || 'none',
      description: description ? `${description.substring(0, 50)}...` : 'none',
      image: image ? 'found' : 'none'
    });

    return {
      title,
      description,
      image,
      favicon,
    };
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

// Helper function to extract YouTube video ID
function getYouTubeVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/,
    /youtube\.com\/watch\?v=([^&]+)/,
    /youtube\.com\/embed\/([^\/]+)/,
    /youtu\.be\/([^\/]+)/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  return null;
}