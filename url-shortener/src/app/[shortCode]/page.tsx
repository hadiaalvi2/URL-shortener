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

    return (
      <main>
        <h1>Debug Short Code: {shortCode}</h1>
      </main>
    )
  } catch (error) {
    console.error('Error in RedirectPage during shortCode display:', error)
    return (
      <main>
        <h1>Error displaying short code</h1>
      </main>
    )
  }
}