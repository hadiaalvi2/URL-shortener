import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { getUrl } from "@/lib/url-store"
import type { Metadata } from "next"
import Image from "next/image"

interface Props {
  params: Promise<{ shortCode: string }>
}

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL!


export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const { shortCode } = await params
    const data = await getUrl(shortCode)
    const metadataBase = new URL(baseUrl)

    if (!data) {
      return {
        title: "Invalid or expired link",
        description: "This short link does not exist or has expired.",
        metadataBase,
      }
    }

    const title = data.title || "Shortened Link"
    const description = data.description || "Open this link"
    
    const imageUrl = data.image 
      ? data.image.startsWith('http') 
        ? data.image 
        : new URL(data.image, metadataBase).toString()
      : new URL("/og-default.png", metadataBase).toString()


    return {
      metadataBase,
      title,
      description,
      openGraph: {
        type: 'website',
        title,
        description,
        url: new URL(`/${shortCode}`, metadataBase).toString(),
        images: [{
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: title,
        }],
        siteName: "URL Shortener",
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: [imageUrl],
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
    const isSocialMediaBot =
      userAgent.includes("facebookexternalhit") ||
      userAgent.includes("Twitterbot") ||
      userAgent.includes("LinkedInBot") ||
      userAgent.includes("WhatsApp") ||
      userAgent.includes("TelegramBot") ||
      userAgent.includes("Discordbot") ||
      userAgent.includes("Slackbot")

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

    // For social media bots, show preview instead of redirecting
    if (isSocialMediaBot) {
      const domain = data.originalUrl ? new URL(data.originalUrl).hostname : "unknown"
      const title = data.title || `Page from ${domain}`
      const description = data.description || "Check out this shared link"
      const imageUrl = data.image || "/og-default.png"


      return (
        <html>
          <head>
            <title>{title}</title>
            {data.favicon && <link rel="icon" href={data.favicon} />}
            <meta property="og:title" content={title} />
            <meta property="og:description" content={description} />
            <meta property="og:image" content={imageUrl} />
            <meta property="og:url" content={`${baseUrl}/${shortCode}`} />
            <meta property="og:type" content="website" />
            <meta property="og:site_name" content="URL Shortener" />
            <meta name="twitter:card" content="summary_large_image" />
            <meta name="twitter:title" content={title} />
            <meta name="twitter:description" content={description} />
            <meta name="twitter:image" content={imageUrl} />
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
                    <div className="w-10 h-10 bg-gray-100 rounded flex items-center justify-center mr-3">
                      <span className="text-gray-500 text-xs">🔗</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h1 className="text-xl font-bold text-gray-900 truncate">
                        {title}
                      </h1>
                      <p className="text-sm text-gray-500 truncate">{domain}</p>
                    </div>
                  </div>
                  <p className="text-gray-700">{description}</p>
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