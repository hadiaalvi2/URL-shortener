import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { getUrl, updateUrlData, isWeakMetadata, refreshUrlMetadata } from "@/lib/url-store"
import { fetchPageMetadata } from "@/lib/utils"
import type { Metadata } from "next"
import Image from "next/image"

interface Props {
  params: Promise<{ shortCode: string }>
}

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL!

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

    // Enhanced metadata refresh with better YouTube handling
    try {
      const shouldRefresh = isWeakMetadata(data) || 
        (data.isYouTube && (!data.description || data.description.length < 100));
      
      if (shouldRefresh) {
        console.log(`[generateMetadata] Refreshing metadata for ${shortCode} (YouTube: ${data.isYouTube})`);
        
        // Use the enhanced refresh function
        const refreshed = await refreshUrlMetadata(shortCode, false);
        if (refreshed && (refreshed.description || refreshed.title)) {
          data = refreshed;
          console.log(`[generateMetadata] Successfully refreshed metadata for ${shortCode}. Description length: ${data.description?.length || 0}`);
        }
      }
    } catch (refreshError) {
      console.error('Error refreshing metadata in generateMetadata:', refreshError);
    }
    
    const domainFallback = original ? original.hostname : undefined
    const title = data.title || domainFallback || 'Shortened Link'
    
    // Enhanced description handling - preserve full description without truncation
    let description = data.description || data.title || undefined
    
    // For YouTube URLs, ensure we show the full description
    if (data.isYouTube && description) {
      // Remove generic YouTube patterns from description for metadata
      const cleanDesc = description.replace(/^(Enjoy the videos and music you love, upload original content, and share it all with friends, family, and the world on YouTube\.|Created using YouTube)/i, '').trim();
      if (cleanDesc.length > 20) {
        description = cleanDesc;
      }
    }
    
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
        // Prefer the original URL so preview platforms show the target domain
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
        card: 'summary_large_image',
        title,
        description,
        images: imageUrl ? [imageUrl] : [],
      },
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
    const ua = userAgent.toLowerCase()
    
    // Enhanced bot detection including more social media platforms
    const isSocialMediaBot =
      ua.includes("facebookexternalhit") ||
      ua.includes("twitterbot") ||
      ua.includes("linkedinbot") ||
      ua.includes("whatsapp") ||
      ua.includes("telegrambot") ||
      ua.includes("discordbot") ||
      ua.includes("slackbot") ||
      ua.includes("skype") ||
      ua.includes("messenger") ||
      ua.includes("instagram") ||
      ua.includes("snapchat") ||
      ua.includes("pinterest") ||
      ua.includes("reddit") ||
      ua.includes("tumblr") ||
      ua.includes("google") ||
      ua.includes("bingbot") ||
      ua.includes("applebot")

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

    if (isSocialMediaBot) {
      const domain = data.originalUrl ? new URL(data.originalUrl).hostname : "unknown"
      let title = data.title
      let description = data.description
      let imageUrl = data.image

      // Enhanced opportunistic refresh for social media bots, especially YouTube
      try {
        const shouldRefresh = isWeakMetadata(data) || 
          (data.isYouTube && (!description || description.length < 100));
        
        if (shouldRefresh) {
          console.log(`[RedirectPage] Bot detected (${ua}), refreshing metadata for ${shortCode} (YouTube: ${data.isYouTube})`);
          
          // Try to get fresh metadata
          const fresh = await fetchPageMetadata(data.originalUrl);
          
          if (fresh.title || fresh.description) {
            // Use better metadata if available
            title = fresh.title || title;
            
            // For YouTube, prefer longer descriptions
            if (fresh.description && (!description || fresh.description.length > description.length)) {
              description = fresh.description;
            }
            
            imageUrl = fresh.image || imageUrl;
            
            // Update stored data for future requests
            await updateUrlData(shortCode, fresh);
            console.log(`[RedirectPage] Successfully refreshed bot metadata for ${shortCode}. New description length: ${description?.length || 0}`);
          }
        }
      } catch (refreshError) {
        console.error('Error refreshing metadata for bot:', refreshError);
      }

      // Enhanced preview page with better YouTube handling
      return (
        <html lang="en">
          <head>
            <meta charSet="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <title>{title || "Shortened Link"}</title>
            
            {/* Favicon */}
            {data.favicon && <link rel="icon" href={data.favicon} />}
            
            {/* Open Graph tags */}
            {title && <meta property="og:title" content={title} />}
            {description && <meta property="og:description" content={description} />}
            {imageUrl && <meta property="og:image" content={imageUrl} />}
            <meta property="og:url" content={data.originalUrl} />
            <meta property="og:type" content="website" />
            <meta property="og:site_name" content="URL Shortener" />
            
            {/* Twitter Card tags */}
            <meta name="twitter:card" content="summary_large_image" />
            {title && <meta name="twitter:title" content={title} />}
            {description && <meta name="twitter:description" content={description} />}
            {imageUrl && <meta name="twitter:image" content={imageUrl} />}
            
            {/* Additional meta tags */}
            {description && <meta name="description" content={description} />}
            <meta name="robots" content="noindex, nofollow" />
            
            {/* Canonical URL */}
            <link rel="canonical" href={data.originalUrl} />
            
            {/* Auto-redirect for non-bot traffic */}
            <script
              dangerouslySetInnerHTML={{
                __html: `
                  setTimeout(function() {
                    if (window.location.search.indexOf('preview=1') === -1) {
                      window.location.href = '${data.originalUrl}';
                    }
                  }, 1000);
                `
              }}
            />
          </head>
          <body className="bg-gray-50 font-sans">
            <main className="min-h-screen p-6">
              <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-lg overflow-hidden">
                {/* Image preview */}
                {imageUrl && (
                  <div className="w-full h-48 bg-gray-200 overflow-hidden">
                    <Image 
                      src={imageUrl} 
                      alt={title || 'Preview Image'}
                      width={800}
                      height={400}
                      className="w-full h-full object-cover"
                      unoptimized={!imageUrl.startsWith(baseUrl)}
                      onError={(e) => {
                        // Hide broken images
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                      }}
                    />
                  </div>
                )}
                
                {/* Content */}
                <div className="p-6 border-b border-gray-200">
                  <div className="flex items-center mb-4">
                    {/* Site icon */}
                    <div className="w-10 h-10 bg-gray-100 rounded flex items-center justify-center mr-3">
                      {data.favicon ? (
                        <Image 
                          src={data.favicon} 
                          alt="Site icon" 
                          width={24} 
                          height={24}
                          className="rounded"
                          onError={(e) => {
                            // Fallback to emoji if favicon fails
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            target.parentElement!.innerHTML = '🔗';
                          }}
                        />
                      ) : (
                        <span className="text-gray-500 text-xs">
                          {data.isYouTube ? '📺' : '🔗'}
                        </span>
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <h1 className="text-xl font-bold text-gray-900 line-clamp-2">
                        {title || 'Shortened Link'}
                      </h1>
                      <p className="text-sm text-gray-500 truncate mt-1">{domain}</p>
                      {data.isYouTube && (
                        <span className="inline-block px-2 py-1 text-xs bg-red-100 text-red-800 rounded-full mt-1">
                          YouTube
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {/* Description with enhanced formatting */}
                  {description && (
                    <div className="text-gray-700 leading-relaxed">
                      {/* For YouTube, format description better */}
                      {data.isYouTube ? (
                        <div className="prose prose-sm max-w-none">
                          {description.split('\n').map((line, i) => (
                            <p key={i} className={i === 0 ? 'font-medium' : ''}>
                              {line.trim() || '\u00A0'}
                            </p>
                          ))}
                        </div>
                      ) : (
                        <p className="line-clamp-4">{description}</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="p-6">
                  <a
                    href={data.originalUrl}
                    className="w-full bg-blue-600 text-white py-3 px-4 rounded-md text-center block hover:bg-blue-700 transition-colors font-medium"
                    rel="noopener noreferrer"
                  >
                    {data.isYouTube ? 'Watch on YouTube' : 'Continue to Website'}
                  </a>
                  
                  {/* Additional info */}
                  <div className="mt-4 text-center">
                    <p className="text-xs text-gray-500">
                      You are being redirected from a shortened URL
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      Original: {data.originalUrl.length > 50 
                        ? data.originalUrl.substring(0, 50) + '...' 
                        : data.originalUrl}
                    </p>
                  </div>
                </div>
              </div>
            </main>
          </body>
        </html>
      )
    }

    // For regular users, redirect immediately
    redirect(data.originalUrl)
    
    return null

  } catch (error) {
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