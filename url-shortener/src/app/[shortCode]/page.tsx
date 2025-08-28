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

    // Always try to refresh metadata for social media previews
    try {
      if (isWeakMetadata(data)) {
        const fresh = await fetchPageMetadata(data.originalUrl)
        const improved = await updateUrlData(shortCode, fresh)
        if (improved) {
          data = improved
        }
      }
    } catch {}
    
    const domainFallback = original ? original.hostname : undefined
    const title = data.title || domainFallback
    const description = data.description || data.title || undefined
    
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
    const isSocialMediaBot =
      ua.includes("facebookexternalhit") ||
      ua.includes("twitterbot") ||
      ua.includes("linkedinbot") ||
      ua.includes("whatsapp") ||
      ua.includes("telegrambot") ||
      ua.includes("discordbot") ||
      ua.includes("slackbot") ||
      ua.includes("pinterest") ||
      ua.includes("redditbot")

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
      let description = data.description || undefined
      let imageUrl = data.image

      // Always refresh metadata for social media bots to ensure fresh data
      try {
        const fresh = await fetchPageMetadata(data.originalUrl)
        title = fresh.title || title
        description = fresh.description || description
        imageUrl = fresh.image || imageUrl
        
        // Update the stored data with fresh metadata
        await updateUrlData(shortCode, { title, description, image: imageUrl })
      } catch {}

      return (
        <html>
          <head>
            <title>{title || "Shortened Link"}</title>
            {data.favicon && <link rel="icon" href={data.favicon} />}
            {title && <meta property="og:title" content={title} />}
            {description && <meta property="og:description" content={description} />}
            {imageUrl && <meta property="og:image" content={imageUrl} />}
            {/* Prefer original URL so chat apps show original domain */}
            <meta property="og:url" content={data.originalUrl} />
            <meta property="og:type" content="website" />
            <meta property="og:site_name" content="URL Shortener" />
            <meta name="twitter:card" content={imageUrl ? "summary_large_image" : "summary"} />
            {title && <meta name="twitter:title" content={title} />}
            {description && <meta name="twitter:description" content={description} />}
            {imageUrl && <meta name="twitter:image" content={imageUrl} />}
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
                    <div className="w-10 h-10 bg-gray-100 rounded flex items-center justify-center mr-3">
                      <span className="text-gray-500 text-xs">🔗</span>
                    </div>
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
                </div>
              </div>
            </main>
          </body>
        </html>
      )
    }

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