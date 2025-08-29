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
    'facebookcatalog',
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
    'duckduckbot',
    'crawler',
    'spider',
    'meta-externalagent',
    'meta-externalhit',
    'instagrambot',
    'snapchatbot',
    'tumblrbot',
    'mastodonbot',
    'signal-desktop',
    'zoom',
    'msteams',
    'line',
    'viber',
    'kakaotalk',
    'wechat',
  ];

  return socialBots.some(bot => ua.includes(bot));
}

// CRITICAL: This runs for metadata generation when social media crawlers visit
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const { shortCode } = await params
    
    // Use social media optimized function for metadata generation
    let data = await import("@/lib/url-store").then(m => m.getUrlForSocialMedia(shortCode))
    const metadataBase = new URL(baseUrl)

    if (!data) {
      return {
        title: "Invalid or expired link",
        description: "This short link does not exist or has expired.",
        metadataBase,
      }
    }

    console.log(`[generateMetadata] Processing social media metadata for shortCode: ${shortCode}`)
    console.log(`[generateMetadata] Optimized data:`, {
      title: data.title,
      description: data.description ? data.description.substring(0, 50) + '...' : 'none',
      hasImage: !!data.image,
      originalUrl: data.originalUrl,
      socialOptimized: data.socialMediaOptimized
    })
    
    const original = data.originalUrl ? new URL(data.originalUrl) : null
    const domainFallback = original ? original.hostname : undefined
    const title = data.title || domainFallback || "Shortened Link"
    const description = data.description || data.title || "Click to view content"
    
    // Enhanced image handling with multiple fallbacks
    let imageUrl = data.image;
    if (!imageUrl || imageUrl.includes('google.com/s2/favicons')) {
      // For YouTube, try to get thumbnail
      if (data.originalUrl && (data.originalUrl.includes('youtube.com') || data.originalUrl.includes('youtu.be'))) {
        const videoId = getYouTubeVideoId(data.originalUrl);
        if (videoId) {
          imageUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
        }
      }
      
      // Fallback to high-quality favicon
      if (!imageUrl) {
        const googleFavicon = original ? `https://www.google.com/s2/favicons?domain=${original.hostname}&sz=512` : undefined;
        imageUrl = data.favicon && !data.favicon.includes('google.com/s2/favicons') ? data.favicon : googleFavicon;
      }
    }

    // Ensure absolute URLs
    if (imageUrl && !imageUrl.startsWith('http')) {
      try {
        imageUrl = new URL(imageUrl, metadataBase).toString();
      } catch {
        imageUrl = undefined;
      }
    }

    console.log(`[generateMetadata] Final metadata:`, {
      title,
      description: description.substring(0, 50) + '...',
      imageUrl: imageUrl ? imageUrl.substring(0, 50) + '...' : 'none'
    })

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
        'article:author': 'URL Shortener',
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
    
    const headersList = await headers()
    const userAgent = headersList.get("user-agent") || ""
    const isBotRequest = isSocialMediaBot(userAgent)

    console.log(`[RedirectPage] User-Agent: ${userAgent.substring(0, 100)}...`)
    console.log(`[RedirectPage] Is Bot: ${isBotRequest}`)

    // Use social media optimized function for bots, regular function for users
    let data = isBotRequest 
      ? await import("@/lib/url-store").then(m => m.getUrlForSocialMedia(shortCode))
      : await getUrl(shortCode)

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
      console.log(`[RedirectPage] Bot detected, serving optimized preview for: ${data.originalUrl}`)
      
      const domain = data.originalUrl ? new URL(data.originalUrl).hostname : "unknown"
      let title = data.title
      let description = data.description || undefined
      let imageUrl = data.image
      let favicon = data.favicon

      // Site-specific enhancements for better social sharing
      if (data.originalUrl) {
        const urlLower = data.originalUrl.toLowerCase();
        
        // YouTube specific enhancements
        if (urlLower.includes('youtube.com') || urlLower.includes('youtu.be')) {
          const videoId = getYouTubeVideoId(data.originalUrl);
          
          if (!description || description.includes('Enjoy the videos and music')) {
            description = title ? `Watch: ${title}` : 'Watch this video on YouTube';
          }
          
          if (videoId && (!imageUrl || imageUrl.includes('google.com/s2/favicons'))) {
            imageUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
          }
          
          if (!favicon || favicon.includes('google.com/s2/favicons')) {
            favicon = 'https://www.youtube.com/s/desktop/12d6b690/img/favicon_32x32.png';
          }
        }
        
        // Twitter/X specific enhancements
        else if (urlLower.includes('twitter.com') || urlLower.includes('x.com')) {
          if (!favicon || favicon.includes('google.com/s2/favicons')) {
            favicon = 'https://abs.twimg.com/favicons/twitter.ico';
          }
          if (!title || title === 'Website') {
            title = 'Post on X (Twitter)';
          }
        }
        
        // Instagram
        else if (urlLower.includes('instagram.com')) {
          if (!favicon || favicon.includes('google.com/s2/favicons')) {
            favicon = 'https://static.cdninstagram.com/rsrc.php/v3/yz/r/VCqbEGliylC.ico';
          }
        }
        
        // LinkedIn
        else if (urlLower.includes('linkedin.com')) {
          if (!favicon || favicon.includes('google.com/s2/favicons')) {
            favicon = 'https://static.licdn.com/sc/h/al2o9zrvru7aqj8e1x2rzsrca';
          }
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

      // Return rich HTML for social media bots with all metadata
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
            {imageUrl && <meta property="og:image:width" content="1200" />}
            {imageUrl && <meta property="og:image:height" content="630" />}
            {imageUrl && <meta property="og:image:alt" content={title || 'Preview'} />}
            <meta property="og:site_name" content="URL Shortener" />
            
            {/* Twitter */}
            <meta name="twitter:card" content={imageUrl ? "summary_large_image" : "summary"} />
            <meta name="twitter:url" content={data.originalUrl} />
            {title && <meta name="twitter:title" content={title} />}
            {description && <meta name="twitter:description" content={description} />}
            {imageUrl && <meta name="twitter:image" content={imageUrl} />}
            
            {/* Additional social media metadata */}
            <meta property="article:author" content="URL Shortener" />
            <link rel="canonical" href={data.originalUrl} />
            <meta name="robots" content="noindex, nofollow" />
            
            {/* Auto-redirect with delay for bots to read metadata */}
            <meta httpEquiv="refresh" content="2;url={data.originalUrl}" />
          </head>
          <body style={{ fontFamily: 'system-ui, sans-serif', margin: 0, padding: '20px', backgroundColor: '#f5f5f5' }}>
            <div style={{ maxWidth: '800px', margin: '0 auto', backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
              {imageUrl && (
                <div style={{ width: '100%', height: '300px', backgroundColor: '#e5e5e5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Image 
                    src={imageUrl} 
                    alt={title || 'Preview Image'}
                    width={800}
                    height={300}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    unoptimized={!imageUrl.startsWith(baseUrl)}
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </div>
              )}
              
              <div style={{ padding: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
                  {favicon && (
                    <div style={{ width: '40px', height: '40px', backgroundColor: '#f0f0f0', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '12px' }}>
                      <Image 
                        src={favicon} 
                        alt="Favicon"
                        width={24}
                        height={24}
                        style={{ objectFit: 'contain' }}
                        unoptimized={!favicon.startsWith(baseUrl)}
                        onError={(e) => {
                          e.currentTarget.src = '/favicon.ico';
                        }}
                      />
                    </div>
                  )}
                  <div>
                    <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: '#1a1a1a' }}>
                      {title || 'Shortened Link'}
                    </h1>
                    <p style={{ margin: 0, fontSize: '14px', color: '#666' }}>{domain}</p>
                  </div>
                </div>
                
                {description && (
                  <p style={{ margin: '0 0 20px 0', fontSize: '16px', lineHeight: '1.5', color: '#333' }}>
                    {description}
                  </p>
                )}

                <a
                  href={data.originalUrl}
                  style={{ 
                    display: 'block', 
                    width: '100%', 
                    backgroundColor: '#2563eb', 
                    color: 'white', 
                    padding: '12px 24px', 
                    borderRadius: '6px', 
                    textAlign: 'center', 
                    textDecoration: 'none',
                    fontWeight: '500',
                    fontSize: '16px',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  Continue to Website
                </a>
                <p style={{ margin: '12px 0 0 0', fontSize: '12px', color: '#666', textAlign: 'center', wordBreak: 'break-all' }}>
                  You will be redirected to: {data.originalUrl}
                </p>
              </div>
            </div>
            
            {/* Auto-redirect script as backup */}
            <script dangerouslySetInnerHTML={{
              __html: `
                setTimeout(function() {
                  window.location.href = "${data.originalUrl}";
                }, 3000);
              `
            }} />
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

// Enhanced YouTube video ID extraction
function getYouTubeVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/,
    /youtube\.com\/watch\?v=([^&]+)/,
    /youtube\.com\/embed\/([^\/]+)/,
    /youtu\.be\/([^\/]+)/,
    /youtube\.com\/v\/([^\/]+)/,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1] && match[1].length === 11) {
      return match[1];
    }
  }
  
  return null;
}