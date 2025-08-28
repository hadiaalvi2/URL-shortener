import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import * as cheerio from "cheerio"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

async function safeFetch(url: string, options: RequestInit = {}, timeout = 5000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(id);
  }
}

export async function fetchPageMetadata(url: string) {
  console.log(`[fetchPageMetadata] Starting metadata fetch for: ${url}`);
  try {
  
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
      // For failed requests, try YouTube-specific extraction if it's a YouTube URL
      if (effectiveUrl.includes('youtube.com') || effectiveUrl.includes('youtu.be')) {
        return await fetchYouTubeMetadata(effectiveUrl);
      }
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

      // Try to extract from JSON-LD
      try {
        const jsonLdScript = $('script[type="application/ld+json"]').html();
        if (jsonLdScript) {
          const jsonLd = JSON.parse(jsonLdScript);
          if (jsonLd && !title) title = jsonLd.name || jsonLd.headline;
          if (jsonLd && !description) description = jsonLd.description;
        }
      } catch (e) {
        console.log('Could not parse JSON-LD');
      }

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

async function fetchYouTubeMetadata(url: string): Promise<{ title?: string; description?: string; image?: string; favicon?: string }> {
  try {
    console.log(`[fetchYouTubeMetadata] Extracting metadata for YouTube video: ${url}`);
    
    const videoId = getYouTubeVideoId(url);
    if (!videoId) {
      console.error('Could not extract YouTube video ID');
      return { title: undefined, description: undefined, image: undefined, favicon: undefined };
    }

    
    try {
      const oEmbedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
      const response = await safeFetch(oEmbedUrl, {}, 5000);

      
      if (response.ok) {
        const data = await response.json();
        const title = data.title;
        const thumbnailUrl = data.thumbnail_url;
        
     
        let description = undefined;
        if (thumbnailUrl) {
          const match = thumbnailUrl.match(/yt\d\.ggpht\.com\/[^/]+\/[^/]+\/[^/]+\/[^/]+\/([^/]+)/);
          if (match && match[1]) {
            description = `${decodeURIComponent(match[1])} • YouTube`;
          }
        }
        
        console.log(`[fetchYouTubeMetadata] Success via oEmbed:`, { title, description });
        return {
          title,
          description: description || `YouTube video by ${data.author_name}`,
          image: thumbnailUrl,
          favicon: 'https://www.youtube.com/favicon.ico'
        };
      }
    } catch (oEmbedError) {
      console.log('[fetchYouTubeMetadata] oEmbed failed, trying alternative methods');
    }
    
   
    try {
      const embedUrl = `https://www.youtube.com/embed/${videoId}`;
      const response = await fetch(embedUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
      
      if (response.ok) {
        const html = await response.text();
        const $ = cheerio.load(html);
        
        const title = $('title').text().replace(' - YouTube', '').trim();
        let description = $('meta[name="description"]').attr('content');
        
       
        if (description && description.includes('Enjoy the videos and music you love')) {
       
          description = `YouTube video${title ? `: ${title}` : ''}`;
        }
        
        console.log(`[fetchYouTubeMetadata] Success via embed:`, { title, description: description ? `${description.substring(0, 50)}...` : 'none' });
        return {
          title,
          description,
          image: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
          favicon: 'https://www.youtube.com/favicon.ico'
        };
      }
    } catch (embedError) {
      console.log('[fetchYouTubeMetadata] Embed method failed');
    }
    

    try {
     
      const microlinkUrl = `https://api.microlink.io?url=${encodeURIComponent(url)}&audio=false&video=false&screenshot=false`;
      const response = await safeFetch(microlinkUrl, {}, 5000);

      
      if (response.ok) {
        const data = await response.json();
        if (data.status === 'success') {
          console.log(`[fetchYouTubeMetadata] Success via microlink:`, { 
            title: data.data.title, 
            description: data.data.description ? `${data.data.description.substring(0, 50)}...` : 'none' 
          });
          return {
            title: data.data.title,
            description: data.data.description,
            image: data.data.image?.url || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
            favicon: 'https://www.youtube.com/favicon.ico'
          };
        }
      }
    } catch (proxyError) {
      console.log('[fetchYouTubeMetadata] Proxy method failed');
    }
    
  
    console.log('[fetchYouTubeMetadata] Using fallback metadata');
    return {
      title: `YouTube Video (${videoId})`,
      description: 'Watch this video on YouTube',
      image: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
      favicon: 'https://www.youtube.com/favicon.ico'
    };
    
  } catch (error) {
    console.error('[fetchYouTubeMetadata] Error extracting YouTube metadata:', error);
    return { title: undefined, description: undefined, image: undefined, favicon: undefined };
  }
}


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