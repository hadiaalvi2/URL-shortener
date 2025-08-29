import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { getUrl, updateUrlData, isWeakMetadata } from "@/lib/url-store"
import { fetchPageMetadata } from "@/lib/utils"
import type { Metadata } from "next"
import Image from "next/image"

interface Props {
  params: Promise<{ shortCode: string }>
}

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL!

// Enhanced social media bot detection with more bots
function isSocialMediaBot(userAgent: string): boolean {
  const ua = userAgent.toLowerCase();
  
  const socialBots = [
    'facebookexternalhit',
    'twitterbot',
    'linkedinbot', 
    'whatsapp',
    'telegrambot',
    'discordbot',
    'slackbot',
    'pinterest',
    'redditbot',
    'skypeuripreview',
    'microsoftpreview',
    'vkshare',
    'applebot',
    'googlebot',
    'bingbot',
    'yandexbot',
    'baiduspider',
    'crawler',
    'spider',
    'meta-externalagent',
    'meta-externalhit',
    'instagrambot',
    'snapchatbot',
    'tumblrbot',
    'mastodonbot',
    'signal-desktop',
    // Additional bots
    'line',
    'kakaotalk',
    'wechat',
    'viber',
    'messenger',
    'imessage',
    'embed',
    'preview',
    'unfurl',
    'card',
    'scraper'
  ];

  return socialBots.some(bot => ua.includes(bot));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const { shortCode } = await params
    let data = await getUrl(shortCode)
    const metadataBase = new URL(baseUrl)

    if (!data) {
      return {
        title: "Invalid or expired link",
        description: "This short link does not exist or has expired.",
        metadataBase,
      }
    }

    // Always try to refresh metadata if it's weak - this is for social media crawlers
    if (isWeakMetadata(data)) {
      console.log('[generateMetadata] Weak metadata detected, force refreshing for social media');
      try {
        const fresh = await fetchPageMetadata(data.originalUrl);
        const improved = await updateUrlData(shortCode, fresh);
        if (improved) {
          console.log('[generateMetadata] Successfully improved metadata');
          data = improved;
        }
      } catch (error) {
        console.error('[generateMetadata] Failed to refresh metadata:', error);
      }
    }
    
    const original = data.originalUrl ? new URL(data.originalUrl) : null
    const domainFallback = original ? original.hostname : undefined
    const title = data.title || domainFallback || "Shortened Link"
    const description = data.description || data.title || "Click to view content"
    
    // Better image handling
    let imageUrl = data.image;
    if (!imageUrl || imageUrl.includes('google.com/s2/favicons')) {
      // Try to get a better image for specific sites
      if (original) {
        if (original.hostname.includes('youtube.com') || original.hostname.includes('youtu.be')) {
          const videoId = getYouTubeVideoId(data.originalUrl);
          if (videoId) {
            imageUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
          }
        } else {
          // Use domain favicon as fallback
          imageUrl = `https://www.google.com/s2/favicons?domain=${original.hostname}&sz=256`;
        }
      }
    }

    return {
      metadataBase,
      title,
      description,
      openGraph: {
        type: 'website',
        title,
        description,
        url: original ? original.toString() : new URL(`/${shortCode}`, metadataBase).toString(),
        images: imageUrl ? [{
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: title || '',
        }] : [],
        siteName: "URL Shortener",
      },
      twitter: {
        card: imageUrl ? 'summary_large_image' : 'summary',
        title,
        description,
        images: imageUrl ? [imageUrl] : [],
      },
      other: {
        'og:site_name': 'URL Shortener',
        'twitter:domain': metadataBase.hostname,
        'twitter:creator': '@urlshortener',
      }
    }
  } catch (error) {
    console.error('Error generating metadata:', error)
    return {
      title: "Error",
      description: "An error occurred while loading this link",
    }
  }
}

export default async function RedirectPage(props: Props) {
  try {
    const { shortCode } = await props.params
    let data = await getUrl(shortCode)

    const headersList = await headers()
    const userAgent = headersList.get("user-agent") || ""
    const isBotRequest = isSocialMediaBot(userAgent)

    console.log(`[RedirectPage] User-Agent: ${userAgent.substring(0, 100)}...`)
    console.log(`[RedirectPage] Is Bot: ${isBotRequest}`)

    if (!data) {
      return (
        <main className="min-h-[60vh] flex items-center justify-center p-6">
          <div className="max-w-md text-center">
            <h1 className="text-2xl font-semibold mb-2">Invalid or expired link</h1>
            <p className="text-muted-foreground">
              The short code &quot;{shortCode}&quot; was not found.
            </p>
          </div>
        </main>
      )
    }

    if (isBotRequest) {
      console.log(`[RedirectPage] Bot detected, serving preview page for: ${data.originalUrl}`);
      
      // AGGRESSIVELY refresh metadata for social media bots
      let refreshedData = data;
      if (isWeakMetadata(data)) {
        console.log(`[RedirectPage] Weak metadata detected for bot, force refreshing...`);
        try {
          const fresh = await fetchPageMetadata(data.originalUrl);
          if (fresh && (fresh.title || fresh.description || fresh.image)) {
            const improved = await updateUrlData(shortCode, fresh);
            if (improved) {
              console.log(`[RedirectPage] Successfully refreshed metadata for bot`);
              refreshedData = improved;
            }
          }
        } catch (error) {
          console.error('[RedirectPage] Failed to refresh metadata for bot:', error);
        }
      }
      
      const domain = refreshedData.originalUrl ? new URL(refreshedData.originalUrl).hostname : "unknown"
      let title = refreshedData.title || "Shared Content"
      let description = refreshedData.description || `Content from ${domain}`
      let imageUrl = refreshedData.image
      let favicon = refreshedData.favicon

      // Enhanced handling for specific sites
      if (refreshedData.originalUrl) {
        if (refreshedData.originalUrl.includes('youtube.com') || refreshedData.originalUrl.includes('youtu.be')) {
          const videoId = getYouTubeVideoId(refreshedData.originalUrl);
          if (videoId) {
            if (!imageUrl || imageUrl.includes('google.com/s2/favicons')) {
              imageUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
            }
            if (!favicon || favicon.includes('google.com/s2/favicons')) {
              favicon = 'https://www.youtube.com/favicon.ico';
            }
            if (description && description.includes('Enjoy the videos')) {
              description = title ? `Watch "${title}" on YouTube` : 'Watch this video on YouTube';
            }
          }
        }
      }

      // Ensure we have good fallbacks
      if (!favicon || favicon.includes('google.com/s2/favicons')) {
        try {
          const urlObj = new URL(refreshedData.originalUrl);
          favicon = `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=128`;
        } catch {
          favicon = '/favicon.ico';
        }
      }

      // Enhanced HTML for bots with better metadata
      return (
        <html>
          <head>
            <title>{title}</title>
            <meta charSet="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            
            {/* Enhanced meta tags */}
            <meta name="title" content={title} />
            {description && <meta name="description" content={description} />}
            <meta name="robots" content="index, follow" />
            
            {/* Favicon */}
            {favicon && <link rel="icon" href={favicon} />}
            
            {/* Open Graph / Facebook */}
            <meta property="og:type" content="website" />
            <meta property="og:url" content={refreshedData.originalUrl} />
            <meta property="og:title" content={title} />
            {description && <meta property="og:description" content={description} />}
            {imageUrl && <meta property="og:image" content={imageUrl} />}
            {imageUrl && <meta property="og:image:width" content="1200" />}
            {imageUrl && <meta property="og:image:height" content="630" />}
            <meta property="og:site_name" content="URL Shortener" />
            
            {/* Twitter */}
            <meta name="twitter:card" content={imageUrl ? "summary_large_image" : "summary"} />
            <meta name="twitter:site" content="@urlshortener" />
            <meta name="twitter:url" content={refreshedData.originalUrl} />
            <meta name="twitter:title" content={title} />
            {description && <meta name="twitter:description" content={description} />}
            {imageUrl && <meta name="twitter:image" content={imageUrl} />}
            
            {/* Additional metadata for better compatibility */}
            <meta property="article:author" content="URL Shortener" />
            <link rel="canonical" href={refreshedData.originalUrl} />
            <meta name="theme-color" content="#1976d2" />
            
            {/* Auto-redirect for non-bot requests that somehow reach here */}
            <meta httpEquiv="refresh" content="0;url={refreshedData.originalUrl}" />
            
            {/* Structured data for better understanding */}
            <script type="application/ld+json">
              {JSON.stringify({
                "@context": "https://schema.org",
                "@type": "WebPage",
                "url": refreshedData.originalUrl,
                "name": title,
                "description": description,
                "image": imageUrl
              })}
            </script>
          </head>
          <body>
            <main className="min-h-screen bg-gray-50 p-6">
              <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-lg overflow-hidden">
                {imageUrl && (
                  <div className="w-full h-48 bg-gray-200 overflow-hidden">
                    <Image 
                      src={imageUrl} 
                      alt={title}
                      width={800}
                      height={400}
                      className="w-full h-full object-cover"
                      unoptimized={!imageUrl.startsWith(baseUrl)}
                    />
                  </div>
                )}
                
                <div className="p-6 border-b border-gray-200">
                  <div className="flex items-center mb-4">
                    {favicon && (
                      <div className="w-10 h-10 bg-gray-100 rounded flex items-center justify-center mr-3 overflow-hidden">
                        <Image 
                          src={favicon} 
                          alt="Site Icon"
                          width={24}
                          height={24}
                          className="object-contain"
                          unoptimized={!favicon.startsWith(baseUrl)}
                        />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h1 className="text-xl font-bold text-gray-900 truncate">
                        {title}
                      </h1>
                      <p className="text-sm text-gray-500 truncate">{domain}</p>
                    </div>
                  </div>
                  {description && <p className="text-gray-700">{description}</p>}
                </div>

                <div className="p-6">
                  <a
                    href={refreshedData.originalUrl}
                    className="w-full bg-blue-600 text-white py-3 px-4 rounded-md text-center block hover:bg-blue-700 transition-colors"
                  >
                    Continue to Website
                  </a>
                  <p className="text-xs text-gray-500 mt-2 text-center">
                    You will be redirected to: {refreshedData.originalUrl}
                  </p>
                </div>
              </div>
            </main>
          </body>
        </html>
      )
    }

    // For regular users, perform immediate redirect
    console.log(`[RedirectPage] Regular user, redirecting to: ${data.originalUrl}`)
    redirect(data.originalUrl)
    
    return null

  } catch (error) {
    // Handle Next.js redirect errors properly
    if (typeof error === 'object' && error !== null && 'digest' in error) {
      throw error
    }
    
    console.error('Error in RedirectPage:', error)
    
    return (
      <main className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-semibold mb-2">Error</h1>
          <p className="text-muted-foreground">
            An error occurred while processing this link.
          </p>
        </div>
      </main>
    )
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