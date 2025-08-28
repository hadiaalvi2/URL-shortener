import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import * as cheerio from "cheerio"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export async function fetchPageMetadata(url: string) {
  console.log(`[fetchPageMetadata] Starting metadata fetch for: ${url}`);
  try {
    // Special handling for YouTube URLs
    const isYouTube = url.includes('youtube.com') || url.includes('youtu.be');
    
    if (isYouTube) {
      console.log(`[fetchPageMetadata] Detected YouTube URL, using specialized extraction`);
      return await fetchYouTubeMetadata(url);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      cache: "no-store",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
      },
    });

    clearTimeout(timeoutId);
    const effectiveUrl = response.url || url;

    if (!response.ok) {
      console.error(`[fetchPageMetadata] Failed to fetch ${url}: ${response.status} ${response.statusText}`);
      return { title: undefined, description: undefined, image: undefined, favicon: undefined };
    }

    const html = await response.text();
    
    let title: string | undefined;
    let description: string | undefined;
    let image: string | undefined;
    let favicon: string | undefined;

    try {
      const $ = cheerio.load(html);

      title = $("meta[property='og:title']").attr("content") ||
              $("meta[name='twitter:title']").attr("content") ||
              $("title").text().trim();

      description = $("meta[property='og:description']").attr("content") ||
                   $("meta[name='description']").attr("content") ||
                   $("meta[name='twitter:description']").attr("content");

      image = $("meta[property='og:image']").attr("content") ||
             $("meta[name='twitter:image']").attr("content");

      favicon = $("link[rel='icon']").attr("href") ||
               $("link[rel='shortcut icon']").attr("href") ||
               $("link[rel='apple-touch-icon']").attr("href");

    } catch (e) {
      console.error('[fetchPageMetadata] Error parsing HTML:', e);
    }

    // Resolve relative URLs
    try {
      const baseUrl = new URL(effectiveUrl);
      
      if (image && !image.startsWith("http")) {
        image = new URL(image, baseUrl.origin).toString();
      }

      if (favicon && !favicon.startsWith("http")) {
        favicon = new URL(favicon, baseUrl.origin).toString();
      }
    } catch (e) {
      console.error('[fetchPageMetadata] Error resolving URLs:', e);
    }

    // Final fallback for favicon
    if (!favicon) {
      try {
        const urlObj = new URL(effectiveUrl);
        favicon = `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=128`;
      } catch {}
    }

    // Clean up title and description
    if (title) {
      title = title.replace(/\s+/g, ' ').trim();
      if (title.includes(' - YouTube')) {
        title = title.replace(' - YouTube', '');
      }
    }

    if (description) {
      description = description.replace(/\s+/g, ' ').trim();
    }

    console.log(`[fetchPageMetadata] Extracted metadata:`, { title, description: description ? `${description.substring(0, 50)}...` : 'none' });

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

// Specialized function for YouTube metadata extraction
async function fetchYouTubeMetadata(url: string): Promise<{ title?: string; description?: string; image?: string; favicon?: string }> {
  try {
    console.log(`[fetchYouTubeMetadata] Extracting metadata for YouTube video: ${url}`);
    
    const videoId = getYouTubeVideoId(url);
    if (!videoId) {
      console.error('Could not extract YouTube video ID');
      return { title: undefined, description: undefined, image: undefined, favicon: undefined };
    }

    // Method 1: Use YouTube oEmbed API (for title and thumbnail)
    try {
      const oEmbedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(oEmbedUrl, { signal: controller.signal });
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const data = await response.json();
        const title = data.title;
        const thumbnailUrl = data.thumbnail_url;
        const authorName = data.author_name;
        
        // Method 2: Try to get description from YouTube page directly
        let description = await getYouTubeDescription(videoId);
        
        // If we can't get the description, use a fallback
        if (!description || description.includes('Enjoy the videos and music')) {
          description = `Music video by ${authorName} performing "${title}".`;
        }
        
        console.log(`[fetchYouTubeMetadata] Success via oEmbed:`, { title, description: description ? `${description.substring(0, 50)}...` : 'none' });
        return {
          title,
          description,
          image: thumbnailUrl,
          favicon: 'https://www.youtube.com/favicon.ico'
        };
      }
    } catch (oEmbedError) {
      console.log('[fetchYouTubeMetadata] oEmbed failed, trying alternative methods');
    }
    
    // Fallback: Try to scrape the YouTube page for description
    try {
      const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
      const response = await fetch(youtubeUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
      
      if (response.ok) {
        const html = await response.text();
        const $ = cheerio.load(html);
        
        const title = $('meta[property="og:title"]').attr('content') || 
                     $('title').text().replace(' - YouTube', '').trim();
        
        let description = $('meta[property="og:description"]').attr('content') ||
                         $('meta[name="description"]').attr('content');
        
        // Clean up description to remove generic YouTube text
        if (description && description.includes('Enjoy the videos and music')) {
          // Try to extract from JSON-LD
          try {
            const jsonLdScript = $('script[type="application/ld+json"]').html();
            if (jsonLdScript) {
              const jsonLd = JSON.parse(jsonLdScript);
              if (jsonLd && jsonLd.description && !jsonLd.description.includes('Enjoy the videos')) {
                description = jsonLd.description;
              }
            }
          } catch (e) {
            console.log('Could not parse JSON-LD for description');
          }
        }
        
        // Final fallback for description
        if (!description || description.includes('Enjoy the videos and music')) {
          description = `Watch "${title}" on YouTube`;
        }
        
        console.log(`[fetchYouTubeMetadata] Success via direct scrape:`, { title, description: description ? `${description.substring(0, 50)}...` : 'none' });
        return {
          title,
          description,
          image: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
          favicon: 'https://www.youtube.com/favicon.ico'
        };
      }
    } catch (scrapeError) {
      console.log('[fetchYouTubeMetadata] Direct scrape failed');
    }
    
    // Final fallback: Construct basic info from video ID
    console.log('[fetchYouTubeMetadata] Using fallback metadata');
    return {
      title: `YouTube Video`,
      description: 'Watch this video on YouTube',
      image: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
      favicon: 'https://www.youtube.com/favicon.ico'
    };
    
  } catch (error) {
    console.error('[fetchYouTubeMetadata] Error extracting YouTube metadata:', error);
    return { title: undefined, description: undefined, image: undefined, favicon: undefined };
  }
}

// Helper function to extract YouTube description
async function getYouTubeDescription(videoId: string): Promise<string | undefined> {
  try {
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    
    if (response.ok) {
      const html = await response.text();
      const $ = cheerio.load(html);
      
      // Try multiple methods to extract description
      let description = $('meta[property="og:description"]').attr('content') ||
                       $('meta[name="description"]').attr('content');
      
      // Try to extract from JSON-LD
      if (!description || description.includes('Enjoy the videos and music')) {
        try {
          const jsonLdScript = $('script[type="application/ld+json"]').html();
          if (jsonLdScript) {
            const jsonLd = JSON.parse(jsonLdScript);
            if (jsonLd && jsonLd.description && !jsonLd.description.includes('Enjoy the videos')) {
              description = jsonLd.description;
            }
          }
        } catch (e) {
          console.log('Could not parse JSON-LD for description');
        }
      }
      
      // Clean up description
      if (description && description.includes('Enjoy the videos and music')) {
        return undefined;
      }
      
      return description;
    }
  } catch (error) {
    console.error('Error fetching YouTube description:', error);
  }
  
  return undefined;
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
