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
    
    
    let videoId: string | null = null;
    if (parsedUrl.hostname.includes('youtube.com')) {
      videoId = parsedUrl.searchParams.get('v');
      
      if (!videoId && parsedUrl.pathname.includes('/shorts/')) {
        videoId = parsedUrl.pathname.split('/shorts/')[1]?.split('?')[0];
      }
     
      if (!videoId && parsedUrl.pathname.includes('/watch')) {
        const pathParts = parsedUrl.pathname.split('/');
        const watchIndex = pathParts.indexOf('watch');
        if (watchIndex !== -1 && pathParts[watchIndex + 1]) {
          videoId = pathParts[watchIndex + 1];
        }
      }
    } else if (parsedUrl.hostname === 'youtu.be') {
      videoId = parsedUrl.pathname.slice(1).split('?')[0];
    }
    
    if (!videoId) {
      console.warn('Could not extract video ID from YouTube URL:', url);
      return await fetchGeneralPageMetadata(url);
    }
    
    console.log(`[fetchYouTubeMetadata] Extracting metadata for video ID: ${videoId}`);
    
    
    const methods = [
      () => extractFromYouTubeOEmbed(url, videoId!),
      () => extractFromYouTubePage(url, videoId!),
      () => extractFromYouTubeAPI(videoId!),
      () => extractFromEmbedPage(videoId!)
    ];
    
    const bestResult: { title?: string; description?: string; image?: string; favicon?: string } = {};
    
    for (const method of methods) {
      try {
        const result = await method();
        
        if (result.title && (!bestResult.title || result.title.length > bestResult.title.length)) {
          bestResult.title = result.title;
        }
        
        if (result.description && (!bestResult.description || result.description.length > bestResult.description.length)) {
          bestResult.description = result.description;
        }
        
        if (result.image && !bestResult.image) {
          bestResult.image = result.image;
        }
        
        
        if (bestResult.description && bestResult.description.length > 100) {
          console.log(`[fetchYouTubeMetadata] Found substantial description (${bestResult.description.length} chars)`);
          break;
        }
        
      } catch (methodError) {
        console.error(`YouTube extraction method failed:`, methodError);
        continue;
      }
    }
    
    return {
      title: bestResult.title,
      description: bestResult.description,
      image: bestResult.image || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
      favicon: 'https://www.youtube.com/favicon.ico'
    };
    
  } catch (error) {
    console.error('Error in fetchYouTubeMetadata:', error);
   
    return await fetchGeneralPageMetadata(url);
  }
}

async function extractFromYouTubeOEmbed(url: string, videoId: string): Promise<{
  title?: string;
  description?: string;
  image?: string;
}> {
  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
    const response = await fetch(oembedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; URLShortener/1.0)',
      }
    });
    
    if (!response.ok) {
      throw new Error(`oEmbed API returned ${response.status}`);
    }
    
    const data = await response.json();
    console.log('[extractFromYouTubeOEmbed] oEmbed data:', data);
    
    return {
      title: data.title,
      description: undefined, 
      image: data.thumbnail_url
    };
    
  } catch (error) {
    console.error('oEmbed extraction failed:', error);
    throw error;
  }
}


async function extractFromYouTubePage(url: string, videoId: string): Promise<{
  title?: string;
  description?: string;
  image?: string;
}> {
  const strategies = [
    () => scrapeWithDesktopHeaders(url),
    () => scrapeWithMobileHeaders(url),
    () => scrapeMobileYouTube(url)
  ];
  
  for (const strategy of strategies) {
    try {
      const result = await strategy();
      if (result.description && result.description.length > 50) {
        console.log(`[extractFromYouTubePage] Strategy succeeded with ${result.description.length} char description`);
        return result;
      }
    } catch (error) {
      console.error('Page scraping strategy failed:', error);
      continue;
    }
  }
  
  throw new Error('All page scraping strategies failed');
}

async function scrapeWithDesktopHeaders(url: string) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
    }
  });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  const html = await response.text();
  return extractMetadataFromHTML(html);
}

async function scrapeWithMobileHeaders(url: string) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    }
  });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  const html = await response.text();
  return extractMetadataFromHTML(html);
}

async function scrapeMobileYouTube(originalUrl: string) {

  const mobileUrl = originalUrl.replace('www.youtube.com', 'm.youtube.com');
  
  const response = await fetch(mobileUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
    }
  });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  const html = await response.text();
  return extractMetadataFromHTML(html);
}

// Method 3: YouTube internal API (using publicly available endpoints)
async function extractFromYouTubeAPI(videoId: string): Promise<{
  title?: string;
  description?: string;
  image?: string;
}> {
  try {
 
    const apiUrl = `https://www.youtube.com/youtubei/v1/player?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8&videoId=${videoId}`;
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'com.google.android.youtube/17.31.35 (Linux; U; Android 11) gzip',
      },
      body: JSON.stringify({
        context: {
          client: {
            clientName: "ANDROID",
            clientVersion: "17.31.35",
            androidSdkVersion: 30,
          }
        },
        videoId: videoId
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      const videoDetails = data?.videoDetails;
      
      if (videoDetails) {
        return {
          title: videoDetails.title,
          description: videoDetails.shortDescription,
          image: videoDetails.thumbnail?.thumbnails?.pop()?.url
        };
      }
    }
    
    throw new Error('API response invalid');
    
  } catch (error) {
    console.error('YouTube API extraction failed:', error);
    throw error;
  }
}

// Method 4: Embed page scraping
async function extractFromEmbedPage(videoId: string): Promise<{
  title?: string;
  description?: string;
  image?: string;
}> {
  const embedUrl = `https://www.youtube.com/embed/${videoId}`;
  
  const response = await fetch(embedUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    }
  });
  
  if (!response.ok) {
    throw new Error(`Embed page returned ${response.status}`);
  }
  
  const html = await response.text();
  return extractMetadataFromHTML(html);
}

// Enhanced HTML metadata extraction
function extractMetadataFromHTML(html: string): {
  title?: string;
  description?: string;
  image?: string;
} {
  let title: string | undefined;
  let description: string | undefined;
  let image: string | undefined;
  
  // Enhanced patterns for better extraction
  const titlePatterns = [
    // Primary video details in JavaScript
    /"videoDetails":\s*{[^{}]*?"title":\s*"([^"]*(?:\\.[^"]*)*)"/,
    /"title":\s*{[^}]*?"runs":\s*\[\s*{\s*"text":\s*"([^"]*(?:\\.[^"]*)*)"/,
    /"title":\s*"([^"]*(?:\\.[^"]*)*)"/,
    // Meta tags
    /<meta property="og:title" content="([^"]+)"/,
    /<meta name="twitter:title" content="([^"]+)"/,
    // Title tag
    /<title>([^<]*?)(?: - YouTube)?<\/title>/,
  ];
  
  const descriptionPatterns = [
    // Most comprehensive - videoDetails shortDescription
    /"videoDetails":\s*{[^{}]*?"shortDescription":\s*"([^"]*(?:\\.[^"]*)*)"/,
    // Alternative videoDetails patterns
    /"shortDescription":\s*"([^"]*(?:\\.[^"]*)*)"/,
    // Description in runs format (handles complex formatting)
    /"description":\s*{\s*"runs":\s*\[((?:\s*{\s*"text":\s*"[^"]*(?:\\.[^"]*)*"\s*}(?:\s*,\s*)?)*)\]/,
    // Simple description field
    /"description":\s*"([^"]*(?:\\.[^"]*)*)"/,
    // Meta tag fallbacks
    /<meta property="og:description" content="([^"]+)"/,
    /<meta name="description" content="([^"]+)"/,
  ];
  
  // Extract title
  for (const pattern of titlePatterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      title = cleanYouTubeString(match[1]);
      if (title && title.length > 3) {
        console.log(`[extractMetadataFromHTML] Found title: ${title}`);
        break;
      }
    }
  }
  
  // Extract description with enhanced handling
  for (const pattern of descriptionPatterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      let rawDesc = match[1];
      
      // Handle runs format specially
      if (pattern.source.includes('"runs"')) {
        rawDesc = extractTextFromRuns(rawDesc);
      }
      
      const cleanDesc = cleanYouTubeString(rawDesc);
      
      if (cleanDesc && cleanDesc.length > 15 && !isGenericYouTubeDescription(cleanDesc)) {
        description = cleanDesc;
        console.log(`[extractMetadataFromHTML] Found description (${cleanDesc.length} chars): ${cleanDesc.substring(0, 150)}...`);
        break;
      }
    }
  }
  
  // Try to extract from ytInitialData if standard patterns failed
  if (!description || description.length < 50) {
    const ytDataPatterns = [
      /var ytInitialData = ({.+?});/,
      /window\["ytInitialData"\] = ({.+?});/,
      /ytInitialData["]\s*=\s*({.+?});/,
      /ytInitialData\s*=\s*({.+?});/
    ];
    
    for (const pattern of ytDataPatterns) {
      const ytDataMatch = html.match(pattern);
      if (ytDataMatch) {
        try {
          const ytData = JSON.parse(ytDataMatch[1]);
          const extractedDesc = extractDescriptionFromYtData(ytData);
          if (extractedDesc && extractedDesc.length > (description?.length || 0)) {
            description = extractedDesc;
            console.log(`[extractMetadataFromHTML] Found description from ytInitialData (${extractedDesc.length} chars)`);
            break;
          }
        } catch (parseError) {
          console.error('Error parsing ytInitialData:', parseError);
          continue;
        }
      }
    }
  }
  
  // Try additional extraction methods if still no good description
  if (!description || description.length < 100) {
    const additionalDesc = tryAlternativeDescriptionExtraction(html);
    if (additionalDesc && additionalDesc.length > (description?.length || 0)) {
      description = additionalDesc;
      console.log(`[extractMetadataFromHTML] Found description via alternative method (${additionalDesc.length} chars)`);
    }
  }
  
  return {
    title: title?.replace(/ - YouTube$/, '').trim(),
    description: description?.trim(),
    image
  };
}

// Enhanced ytInitialData extraction
function extractDescriptionFromYtData(data: Record<string, unknown>): string | undefined {
  try {
  
    const videoDetails = data?.videoDetails as Record<string, unknown>;
    if (videoDetails?.shortDescription && typeof videoDetails.shortDescription === 'string') {
      const desc = cleanYouTubeString(videoDetails.shortDescription);
      if (desc && desc.length > 20) {
        return desc;
      }
    }
    
   
    const paths = [
      'contents.twoColumnWatchNextResults.results.results.contents',
      'contents.twoColumnWatchNextResults.results.results',
      'response.contents.twoColumnWatchNextResults.results.results.contents'
    ];
    
    for (const path of paths) {
      const contents = getNestedValue(data, path);
      if (Array.isArray(contents)) {
        for (const content of contents) {
          // Check various renderer types
          const renderers = [
            'videoSecondaryInfoRenderer',
            'videoPrimaryInfoRenderer',
            'videoDescriptionRenderer'
          ];
          
          for (const rendererType of renderers) {
            const renderer = content[rendererType];
            if (renderer?.description) {
              const desc = extractTextFromComplexStructure(renderer.description);
              if (desc && desc.length > 20) {
                return desc;
              }
            }
          }
        }
      }
    }
    
   
    const description = findDescriptionInObject(data);
    if (description && description.length > 20) {
      return description;
    }
    
   } catch (error) {
    console.error('Error in extractDescriptionFromYtData:', error);
  }
  return undefined;
}


function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce((current: unknown, key: string) => {
    if (current && typeof current === 'object' && key in (current as Record<string, unknown>)) {
      return (current as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}



function findDescriptionInObject(obj: unknown, visited = new Set()): string | undefined {
  if (!obj || typeof obj !== 'object' || visited.has(obj)) {
    return undefined;
  }
  
  visited.add(obj);
  
  const objRecord = obj as Record<string, unknown>;
  
  // Check if current object has description
  if (objRecord.shortDescription && typeof objRecord.shortDescription === 'string') {
    const desc = cleanYouTubeString(objRecord.shortDescription);
    if (desc.length > 20) return desc;
  }
  
  if (objRecord.description) {
    if (typeof objRecord.description === 'string') {
      const desc = cleanYouTubeString(objRecord.description);
      if (desc.length > 20) return desc;
    } else if (typeof objRecord.description === 'object') {
      const desc = extractTextFromComplexStructure(objRecord.description);
      if (desc && desc.length > 20) return desc;
    }
  }
  
  // Recursively search in arrays and objects
  for (const [key, value] of Object.entries(objRecord)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        const found = findDescriptionInObject(item, visited);
        if (found) return found;
      }
    } else if (typeof value === 'object') {
      const found = findDescriptionInObject(value, visited);
      if (found) return found;
    }
  }
  
  return undefined;
}

function extractTextFromComplexStructure(descriptionObj: unknown): string | undefined {
  try {
    if (typeof descriptionObj === 'string') {
      return cleanYouTubeString(descriptionObj);
    }
    
    if (descriptionObj && typeof descriptionObj === 'object') {
      const descObj = descriptionObj as Record<string, unknown>;
      
      // Handle runs array
      if (descObj.runs && Array.isArray(descObj.runs)) {
        const text = (descObj.runs as Array<Record<string, unknown>>)
          .map((run: Record<string, unknown>) => run.text || '')
          .join('')
          .trim();
        return cleanYouTubeString(text as string);
      }
      
      // Handle simpleText
      if (descObj.simpleText && typeof descObj.simpleText === 'string') {
        return cleanYouTubeString(descObj.simpleText);
      }
      
      // Handle content array
      if (descObj.content && Array.isArray(descObj.content)) {
        const text = (descObj.content as Array<Record<string, unknown>>)
          .map((item: Record<string, unknown>) => item.text || '')
          .join('')
          .trim();
        return cleanYouTubeString(text as string);
      }
    }
    
  } catch (error) {
    console.error('Error in extractTextFromComplexStructure:', error);
  }
  
  return undefined;
}

function tryAlternativeDescriptionExtraction(html: string): string | undefined {
  const patterns = [
   
    /"description":\s*"([^"]{100,}(?:\\.[^"]*)*)"/g,
 
    /itemprop="description"[^>]*content="([^"]{50,})"/,
   
    /<meta[^>]+name="description"[^>]+content="([^"]{50,})"/i,
  
    /"VideoObject"[^}]*"description":\s*"([^"]{50,}(?:\\.[^"]*)*)"/,
  ];
  
  for (const pattern of patterns) {
    const matches = html.matchAll(pattern);
    for (const match of matches) {
      if (match[1]) {
        const desc = cleanYouTubeString(match[1]);
        if (desc.length > 50 && !isGenericYouTubeDescription(desc)) {
          return desc;
        }
      }
    }
  }
  
  return undefined;
}

// Extract text from runs format
function extractTextFromRuns(runsString: string): string {
  try {
    // Parse the runs array structure
    const runsMatch = runsString.match(/{\s*"text":\s*"([^"]*(?:\\.[^"]*)*)"/g);
    if (runsMatch) {
      return runsMatch
        .map(match => {
          const textMatch = match.match(/"text":\s*"([^"]*(?:\\.[^"]*)*)"/);
          return textMatch ? textMatch[1] : '';
        })
        .join('')
        .trim();
    }
    return runsString;
  } catch (error) {
    console.error('Error extracting text from runs:', error);
    return runsString;
  }
}

// Enhanced string cleaning for YouTube content
function cleanYouTubeString(str: string): string {
  if (!str) return '';
  
  return str
    // Handle escaped characters
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\"/g, '"')
    .replace(/\\'/g, "'")
    .replace(/\\\\/g, '\\')
    // Handle Unicode escapes
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, code) => 
      String.fromCharCode(parseInt(code, 16))
    )
    // Clean up whitespace but preserve line breaks
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s+/g, '\n')
    .replace(/\s+\n/g, '\n')
    .trim();
}

// Enhanced generic description detection
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
    'like and subscribe',
    'click here to subscribe',
    'visit our website',
    'follow us on',
    'check out our',
    'don\'t forget to',
    'please subscribe',
    'hit the bell',
    'notification bell'
  ];
  
  const lowerDesc = description.toLowerCase().trim();
  
  // Check for generic patterns
  const hasGenericPattern = generic.some(pattern => lowerDesc.includes(pattern));
  if (hasGenericPattern) return true;
  
  // Check if it's mostly URLs
  const urlPattern = /(https?:\/\/[^\s]+)/g;
  const urls = description.match(urlPattern) || [];
  const urlLength = urls.join('').length;
  
  // If more than 80% is URLs, consider it weak
  const isMainlyUrls = urlLength / description.length > 0.8;
  
  return isMainlyUrls;
}

// Fallback to general page metadata extraction
async function fetchGeneralPageMetadata(url: string) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const html = await response.text();
    
    if (html) {
      const $ = cheerio.load(html);

      const readMeta = (selectors: string[]): string | undefined => {
        for (const sel of selectors) {
          const val = $(sel).attr("content") || $(sel).attr("href");
          if (val && typeof val === "string" && val.trim().length > 0) return val.trim();
        }
        return undefined;
      };

      const title = $("head title").text().trim() ||
        readMeta([
          "meta[property='og:title']",
          "meta[name='og:title']",
          "meta[name='twitter:title']",
        ]);

      const description = readMeta([
        "meta[name='description']",
        "meta[property='og:description']",
        "meta[name='og:description']",
        "meta[name='twitter:description']",
      ]);

      const image = readMeta([
        "meta[property='og:image']",
        "meta[property='og:image:url']",
        "meta[name='twitter:image']",
        "link[rel='image_src']",
      ]);

      const favicon = readMeta([
        "link[rel='icon']",
        "link[rel='shortcut icon']",
        "link[rel='apple-touch-icon']",
      ]);

      return { title, description, image, favicon };
    }

    return {};
    
  } catch (error) {
    console.error('General page metadata extraction failed:', error);
    return {};
  }
}

// Main entry point for page metadata extraction
export async function fetchPageMetadata(url: string) {
  console.log(`[fetchPageMetadata] Starting metadata fetch for: ${url}`);
  
  try {
    const parsedUrl = new URL(url);
    const isYouTube = parsedUrl.hostname.includes('youtube.com') || parsedUrl.hostname === 'youtu.be';
    
    if (isYouTube) {
      console.log(`[fetchPageMetadata] Detected YouTube URL, using specialized extraction`);
      const result = await fetchYouTubeMetadata(url);
      
      if (result.title || result.description) {
        console.log(`[fetchPageMetadata] YouTube extraction successful. Title: ${!!result.title}, Description length: ${result.description?.length || 0}`);
        return result;
      }
    }
  } catch (error) {
    console.error('Error in YouTube-specific extraction:', error);
  }
  
  // Fallback to general metadata extraction
  console.log(`[fetchPageMetadata] Using general metadata extraction`);
  return await fetchGeneralPageMetadata(url);
}