import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import * as cheerio from "cheerio"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Enhanced YouTube metadata extraction functions
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
    
    // Method 1: Try oEmbed API first for title
    let oembedTitle: string | undefined;
    try {
      const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
      const oembedResponse = await fetch(oembedUrl);
      
      if (oembedResponse.ok) {
        const oembedData = await oembedResponse.json();
        oembedTitle = oembedData.title;
      }
    } catch (oembedError) {
      console.error('oEmbed method failed:', oembedError);
    }
    
    // Method 2: Enhanced page scraping for description
    const scrapedData = await scrapeYouTubePageEnhanced(url, videoId);
    
    return {
      title: oembedTitle || scrapedData.title,
      description: scrapedData.description,
      image: scrapedData.image || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
      favicon: 'https://www.youtube.com/favicon.ico'
    };
    
  } catch (error) {
    console.error('Error in fetchYouTubeMetadata:', error);
    return {};
  }
}

async function scrapeYouTubePageEnhanced(url: string, videoId: string): Promise<{
  title?: string;
  description?: string;
  image?: string;
}> {
  try {
    // Try multiple approaches for better success rate
    const approaches = [
      () => scrapeWithStandardHeaders(url),
      () => scrapeWithMobileHeaders(url),
      () => scrapeEmbedPage(videoId)
    ];
    
    for (const approach of approaches) {
      try {
        const result = await approach();
        if (result.description && result.description.length > 50) {
          console.log(`[scrapeYouTubePageEnhanced] Successfully extracted: ${result.description.substring(0, 100)}...`);
          return result;
        }
      } catch (approachError) {
        console.error('Approach failed:', approachError);
        continue;
      }
    }
    
    return {
      image: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`
    };
    
  } catch (error) {
    console.error('Error in scrapeYouTubePageEnhanced:', error);
    return {};
  }
}

async function scrapeWithStandardHeaders(url: string) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'DNT': '1',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
    }
  });
  
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  
  const html = await response.text();
  return extractMetadataFromHTML(html);
}

async function scrapeWithMobileHeaders(url: string) {
  // Try mobile version which sometimes has cleaner HTML
  const mobileUrl = url.replace('www.youtube.com', 'm.youtube.com');
  
  const response = await fetch(mobileUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-us',
      'Accept-Encoding': 'gzip, deflate, br',
    }
  });
  
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  
  const html = await response.text();
  return extractMetadataFromHTML(html);
}

async function scrapeEmbedPage(videoId: string) {
  const embedUrl = `https://www.youtube.com/embed/${videoId}`;
  
  const response = await fetch(embedUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    }
  });
  
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  
  const html = await response.text();
  return extractMetadataFromHTML(html);
}

function extractMetadataFromHTML(html: string): {
  title?: string;
  description?: string;
  image?: string;
} {
  let title: string | undefined;
  let description: string | undefined;
  
  // Enhanced patterns for better extraction - order matters (most specific first)
  const titlePatterns = [
    /"videoDetails":\s*{[^{}]*?"title":\s*"([^"]*(?:\\.[^"]*)*)"/,
    /"title":\s*"([^"]*(?:\\.[^"]*)*)"/,
    /<meta property="og:title" content="([^"]+)"/,
    /<title>([^<]*?)(?: - YouTube)?<\/title>/
  ];
  
  const descriptionPatterns = [
    // Most comprehensive pattern for full description
    /"videoDetails":\s*{[^{}]*?"shortDescription":\s*"([^"]*(?:\\.[^"]*)*)"/s,
    // Alternative videoDetails pattern
    /"shortDescription":\s*"([^"]*(?:\\.[^"]*)*)"/s,
    // JSON-LD structured data
    /"description":\s*"([^"]*(?:\\.[^"]*)*)"/s,
    // Meta tags as fallback
    /<meta property="og:description" content="([^"]+)"/,
    /<meta name="description" content="([^"]+)"/,
    // Try to find description in runs array
    /"description":\s*{\s*"runs":\s*\[\s*{\s*"text":\s*"([^"]*(?:\\.[^"]*)*)"/s
  ];
  
  // Extract title
  for (const pattern of titlePatterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      title = cleanYouTubeString(match[1]);
      if (title && title.length > 5) break;
    }
  }
  
  // Extract description with more aggressive patterns
  for (const pattern of descriptionPatterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      let rawDesc = match[1];
      
      // Handle multiline descriptions better
      const cleanDesc = cleanYouTubeString(rawDesc);
      
      if (cleanDesc && cleanDesc.length > 20 && !isGenericYouTubeDescription(cleanDesc)) {
        // Don't truncate - keep the full description
        description = cleanDesc;
        console.log(`[extractMetadataFromHTML] Found description (${cleanDesc.length} chars): ${cleanDesc.substring(0, 200)}...`);
        break;
      }
    }
  }
  
  // If standard patterns failed, try to extract from ytInitialData
  if (!description || description.length < 50) {
    const ytDataMatch = html.match(/var ytInitialData = ({.+?});/) ||
                       html.match(/window\["ytInitialData"\] = ({.+?});/);
    
    if (ytDataMatch) {
      try {
        const ytData = JSON.parse(ytDataMatch[1]);
        const extractedDesc = extractDescriptionFromYtData(ytData);
        if (extractedDesc && extractedDesc.length > (description?.length || 0)) {
          description = extractedDesc;
          console.log(`[extractMetadataFromHTML] Found description from ytInitialData: ${description.substring(0, 200)}...`);
        }
      } catch (parseError) {
        console.error('Error parsing ytInitialData:', parseError);
      }
    }
  }
  
  return {
    title: title?.replace(/ - YouTube$/, ''),
    description,
    image: undefined // Will be set by caller
  };
}

function extractDescriptionFromYtData(data: any): string | undefined {
  try {
    // Navigate YouTube's complex data structure
    const contents = data?.contents?.twoColumnWatchNextResults?.results?.results?.contents;
    
    if (contents && Array.isArray(contents)) {
      for (const content of contents) {
        // Look for video secondary info renderer
        const secondaryInfo = content?.videoSecondaryInfoRenderer;
        if (secondaryInfo?.description) {
          const desc = extractTextFromRuns(secondaryInfo.description);
          if (desc && desc.length > 50) {
            return desc;
          }
        }
        
        // Also check primary info
        const primaryInfo = content?.videoPrimaryInfoRenderer;
        if (primaryInfo?.videoActions?.menuRenderer?.topLevelButtons) {
          // Sometimes description is nested deeper
          continue;
        }
      }
    }
    
    // Try alternative structure
    if (data?.videoDetails?.shortDescription) {
      return cleanYouTubeString(data.videoDetails.shortDescription);
    }
    
  } catch (error) {
    console.error('Error extracting from ytInitialData:', error);
  }
  
  return undefined;
}

function extractTextFromRuns(descriptionObj: any): string | undefined {
  try {
    if (descriptionObj?.runs && Array.isArray(descriptionObj.runs)) {
      return descriptionObj.runs
        .map((run: any) => run.text || '')
        .join('')
        .trim();
    }
    
    if (typeof descriptionObj === 'string') {
      return descriptionObj.trim();
    }
    
    if (descriptionObj?.simpleText) {
      return descriptionObj.simpleText.trim();
    }
    
  } catch (error) {
    console.error('Error extracting text from runs:', error);
  }
  
  return undefined;
}

function cleanYouTubeString(str: string): string {
  if (!str) return '';
  
  return str
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\')
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, code) => 
      String.fromCharCode(parseInt(code, 16))
    )
    .replace(/\s+/g, ' ')
    .trim();
}

function isGenericYouTubeDescription(description: string): boolean {
  if (!description || description.length < 15) return true;
  
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
    'like and subscribe',
    'click here to subscribe',
    'visit our website',
    'follow us on'
  ];
  
  const lowerDesc = description.toLowerCase().trim();
  
  // Check for generic patterns
  const hasGenericPattern = generic.some(pattern => lowerDesc.includes(pattern));
  
  // Check if it's mostly URLs or hashtags
  const urlPattern = /(https?:\/\/[^\s]+)/g;
  const hashtagPattern = /#\w+/g;
  const urls = description.match(urlPattern) || [];
  const hashtags = description.match(hashtagPattern) || [];
  
  const contentLength = description.length;
  const urlLength = urls.join('').length;
  const hashtagLength = hashtags.join('').length;
  
  // If more than 70% is URLs and hashtags, consider it weak
  const isMainlyUrls = (urlLength + hashtagLength) / contentLength > 0.7;
  
  return hasGenericPattern || isMainlyUrls;
}

// Enhanced page metadata extraction
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
        console.log(`[fetchPageMetadata] Successfully extracted YouTube metadata. Description length: ${youtubeMetadata.description?.length || 0}`);
        return youtubeMetadata;
      }
    }
  } catch (urlError) {
    console.error('Error parsing URL for YouTube detection:', urlError);
  }
  
  // Continue with existing general metadata extraction for non-YouTube URLs
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // Increased timeout

    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      cache: "no-store",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
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
    const html = response.ok ? await response.text() : "";
    
    let title: string | undefined;
    let description: string | undefined;
    let image: string | undefined;
    let favicon: string | undefined;

    if (html) {
      const $ = cheerio.load(html);

      const readMeta = (selectors: string[]): string | undefined => {
        for (const sel of selectors) {
          const val = $(sel).attr("content") || $(sel).attr("href");
          if (val && typeof val === "string" && val.trim().length > 0) return val.trim();
        }
        return undefined;
      };

      title = $("head title").text().trim() ||
        readMeta([
          "meta[property='og:title']",
          "meta[name='og:title']",
          "meta[name='twitter:title']",
          "meta[itemprop='name']",
        ]);

      description = readMeta([
        "meta[name='description']",
        "meta[property='og:description']",
        "meta[name='og:description']",
        "meta[name='twitter:description']",
        "meta[itemprop='description']",
      ]);

      const candidateImageSelectors = [
        "meta[property='og:image']",
        "meta[property='og:image:url']",
        "meta[name='twitter:image']",
        "link[rel='image_src']",
        "meta[itemprop='image']",
      ];
      
      for (const sel of candidateImageSelectors) {
        const imgUrl = $(sel).attr("content") || $(sel).attr("href");
        if (imgUrl) {
          image = imgUrl;
          break;
        }
      }

      favicon = $("link[rel='icon']").attr("href") ||
        $("link[rel='shortcut icon']").attr("href") ||
        $("link[rel='apple-touch-icon']").attr("href");
    }

    // Resolve relative URLs
    try {
      const baseUrl = new URL(response.url || url);
      
      if (image && !image.startsWith('http')) {
        image = new URL(image, baseUrl.origin).toString();
      }
      
      if (favicon && !favicon.startsWith('http')) {
        favicon = new URL(favicon, baseUrl.origin).toString();
      }
    } catch (e) {
      console.error('Error resolving URLs:', e);
    }

    return {
      title: title || undefined,
      description: description || undefined, // Keep full description, no truncation
      image: image || undefined,
      favicon: favicon || undefined,
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