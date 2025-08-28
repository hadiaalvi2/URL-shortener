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

// Enhanced social media bot detection
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
    'telegrambot',
    'signal-desktop',
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

    const original = data.originalUrl ? new URL(data.originalUrl) : null

    // Force refresh metadata for YouTube URLs to get better description
    try {
      if (data.originalUrl && (data.originalUrl.includes('youtube.com') || data.originalUrl.includes('youtu.be'))) {
        console.log('[generateMetadata] Force refreshing YouTube metadata')
        const fresh = await fetchPageMetadata(data.originalUrl)
        const improved = await updateUrlData(shortCode, fresh)
        if (improved) {
          data = improved
        }
      } else if (isWeakMetadata(data)) {
        const fresh = await fetchPageMetadata(data.originalUrl)
        const improved = await updateUrlData(shortCode, fresh)
        if (improved) {
          data = improved
        }
      }
    } catch (error) {
      console.error('Error refreshing metadata in generateMetadata:', error)
    }
    
    const domainFallback = original ? original.hostname : undefined
    const title = data.title || domainFallback || "Shortened Link"
    const description = data.description || data.title || "Click to view content"
    
    const googleFavicon = original ? `https://www.google.com/s2/favicons?domain=${original.hostname}&sz=256` : undefined
    const imageUrl = data.image 
      ? data.image.startsWith('http') 
        ? data.image 
        : new URL(data.image, metadataBase).toString()
      : (data.favicon || googleFavicon)

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
    const data = await getUrl(shortCode)

    const headersList = await headers()
    const userAgent = headersList.get("user-agent") || ""
    const isBotRequest = isSocialMediaBot(userAgent)

    console.log(`[RedirectPage] User-Agent: ${userAgent}`)
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
      console.log(`[RedirectPage] Bot detected, serving preview page for: ${data.originalUrl}`)
      
      const domain = data.originalUrl ? new URL(data.originalUrl).hostname : "unknown"
      let title = data.title
      let description = data.description || undefined
      let imageUrl = data.image
      let favicon = data.favicon

      // FORCE refresh metadata for social media bots, especially for YouTube
      try {
        console.log(`[SocialMediaBot] Refreshing metadata for: ${data.originalUrl}`);
        const fresh = await fetchPageMetadata(data.originalUrl)
        
        // Only update if we got better data
        if (fresh.title && (!title || isWeakMetadata({ title, description }))) {
          title = fresh.title
        }
        if (fresh.description && (!description || description.includes('Enjoy the videos'))) {
          description = fresh.description
        }
        if (fresh.image && (!imageUrl || imageUrl.includes('google.com/s2/favicons'))) {
          imageUrl = fresh.image
        }
        if (fresh.favicon && (!favicon || favicon.includes('google.com/s2/favicons'))) {
          favicon = fresh.favicon
        }
        
        // Update the stored data with fresh metadata
        await updateUrlData(shortCode, { 
          title: title || data.title, 
          description: description || data.description, 
          image: imageUrl || data.image, 
          favicon: favicon || data.favicon 
        })
        
        console.log(`[SocialMediaBot] Updated metadata:`, { 
          title, 
          description: description ? `${description.substring(0, 50)}...` : 'none',
          hasImage: !!imageUrl,
          hasFavicon: !!favicon
        });
      } catch (error) {
        console.error('[SocialMediaBot] Error refreshing metadata:', error);
      }

      // For YouTube, ensure we have a proper description and favicon
      if (data.originalUrl && (data.originalUrl.includes('youtube.com') || data.originalUrl.includes('youtu.be'))) {
        // Ensure we have a proper description (not generic YouTube text)
        if (!description || description.includes('Enjoy the videos and music')) {
          description = title || 'Watch this video on YouTube';
        }
        
        // Ensure we have a high-quality thumbnail
        const videoId = getYouTubeVideoId(data.originalUrl);
        if (videoId && (!imageUrl || imageUrl.includes('google.com/s2/favicons'))) {
          imageUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
        }
        
        // Ensure we have YouTube favicon
        if (!favicon || favicon.includes('google.com/s2/favicons')) {
          favicon = 'https://www.youtube.com/favicon.ico';
        }
      }

      // Ensure we have a favicon fallback
      if (!favicon) {
        try {
          const urlObj = new URL(data.originalUrl);
          favicon = `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=128`;
        } catch {
          favicon = '/favicon.ico';
        }
      }

      // Enhanced HTML for bots with better Open Graph and Twitter Card support
      return (
        <html>
          <head>
            <title>{title || "Shortened Link"}</title>
            <meta charSet="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            
            {/* Favicon */}
            {favicon && <link rel="icon" href={favicon} />}
            
            {/* Basic meta tags */}
            {title && <meta name="title" content={title} />}
            {description && <meta name="description" content={description} />}
            
            {/* Open Graph / Facebook */}
            <meta property="og:type" content="website" />
            <meta property="og:url" content={data.originalUrl} />
            {title && <meta property="og:title" content={title} />}
            {description && <meta property="og:description" content={description} />}
            {imageUrl && <meta property="og:image" content={imageUrl} />}
            <meta property="og:site_name" content="URL Shortener" />
            
            {/* Twitter */}
            <meta name="twitter:card" content={imageUrl ? "summary_large_image" : "summary"} />
            <meta name="twitter:url" content={data.originalUrl} />
            {title && <meta name="twitter:title" content={title} />}
            {description && <meta name="twitter:description" content={description} />}
            {imageUrl && <meta name="twitter:image" content={imageUrl} />}
            
            {/* Additional metadata for better compatibility */}
            <meta property="article:author" content="URL Shortener" />
            <link rel="canonical" href={data.originalUrl} />
            
            {/* Auto-redirect for non-bot requests that somehow reach here */}
            <meta httpEquiv="refresh" content="0;url={data.originalUrl}" />
          </head>
          <body>
            <main className="min-h-screen bg-gray-50 p-6">
              <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-lg overflow-hidden">
                {imageUrl && (
                  <div className="w-full h-48 bg-gray-200 overflow-hidden">
                    <Image 
                      src={imageUrl} 
                      alt={title || 'Preview Image'}
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
                          alt="Favicon"
                          width={24}
                          height={24}
                          className="object-contain"
                          unoptimized={!favicon.startsWith(baseUrl)}
                        />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h1 className="text-xl font-bold text-gray-900 truncate">
                        {title || 'Shortened Link'}
                      </h1>
                      <p className="text-sm text-gray-500 truncate">{domain}</p>
                    </div>
                  </div>
                  {description && <p className="text-gray-700">{description}</p>}
                </div>

                <div className="p-6">
                  <a
                    href={data.originalUrl}
                    className="w-full bg-blue-600 text-white py-3 px-4 rounded-md text-center block hover:bg-blue-700 transition-colors"
                  >
                    Continue to Website
                  </a>
                  <p className="text-xs text-gray-500 mt-2 text-center">
                    You will be redirected to: {data.originalUrl}
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