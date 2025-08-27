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

      // Attempt to extract metadata from JSON-LD
      $('script[type="application/ld+json"]').each((_idx, el) => {
        try {
          const ldJson = JSON.parse($(el).text());
          console.log('[fetchPageMetadata] Found JSON-LD:', ldJson);
          
          // Prioritize JSON-LD if it contains better data
          if (ldJson['@type'] === 'WebPage' || ldJson['@type'] === 'Product' || ldJson['@type'] === 'Article') {
            title = title || ldJson.name || ldJson.headline || ldJson.url;
            description = description || ldJson.description;
            
            if (ldJson.image) {
              // JSON-LD image can be a string or an object with a 'url' property
              const ldImage = typeof ldJson.image === 'string' ? ldJson.image : ldJson.image.url;
              image = image || ldImage;
            }
          } else if (Array.isArray(ldJson)) {
              // Handle cases where JSON-LD is an array of objects
              for (const item of ldJson) {
                  if (item['@type'] === 'WebPage' || item['@type'] === 'Product' || item['@type'] === 'Article') {
                      title = title || item.name || item.headline || item.url;
                      description = description || item.description;
                      if (item.image) {
                          const ldImage = typeof item.image === 'string' ? item.image : item.image.url;
                          image = image || ldImage;
                      }
                  }
              }
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

    // AMP page fallback for commerce/publisher sites
    try {
      if (!image || !title || !description) {
        const $h = cheerio.load(html);
        const ampHref = $h("link[rel='amphtml']").attr("href");
        if (ampHref) {
          const ampUrl = new URL(ampHref, new URL(effectiveUrl).origin).toString();
          console.log(`[fetchPageMetadata] Fetching AMP page: ${ampUrl}`);
          const ampRes = await fetch(ampUrl, { cache: "no-store" });
          if (ampRes.ok) {
            const ampHtml = await ampRes.text();
            const $a = cheerio.load(ampHtml);
            title = title || $a("meta[property='og:title']").attr("content") || $a("head title").text().trim();
            description = description ||
              $a("meta[property='og:description']").attr("content") ||
              $a("meta[name='description']").attr("content");
            image = image ||
              $a("meta[property='og:image']").attr("content") ||
              $a("meta[name='twitter:image']").attr("content");
          }
        }
      }
    } catch (ampErr) {
      console.warn('[fetchPageMetadata] AMP fallback failed:', ampErr);
    }

    // YouTube thumbnail heuristic
    try {
      const u = new URL(effectiveUrl);
      if ((!image || image.length === 0) && (u.hostname.endsWith("youtube.com") || u.hostname === "youtu.be")) {
        let vid = u.searchParams.get("v");
        if (!vid) {
          const parts = u.pathname.split("/").filter(Boolean);
          vid = parts[0];
        }
        if (vid) {
          image = `https://img.youtube.com/vi/${vid}/maxresdefault.jpg`;
        }
      }
    } catch {}

    // Final pass: provide a sensible favicon fallback via Google S2 service
    try {
      const baseForFavicon = new URL(url);
      if (!favicon) {
        favicon = `https://www.google.com/s2/favicons?domain=${baseForFavicon.hostname}&sz=128`;
      }
    } catch {}

    // External service fallback (optional): Microlink
    try {
      if ((!title && !description && !image) || !image) {
        const apiKey = process.env.MICROLINK_API_KEY;
        if (apiKey) {
          const mUrl = `https://pro.microlink.io/?url=${encodeURIComponent(url)}&audio=false&video=false&iframe=false&screenshot=false`;
          const mRes = await fetch(mUrl, { headers: { 'x-api-key': apiKey }, cache: 'no-store' });
          if (mRes.ok) {
            const json = await mRes.json();
            const data = json && json.data ? json.data : {};
            title = title || data.title;
            description = description || data.description;
            image = image || (data.image && (data.image.url || data.image.src));
            favicon = favicon || (data.logo && (data.logo.url || data.logo.src));
          }
        }
      }
    } catch (svcErr) {
      console.warn('[fetchPageMetadata] Microlink fallback failed or not configured:', svcErr);
    }

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