import { type NextRequest, NextResponse } from "next/server"
import { createShortCode } from "@/lib/url-store"

function normalizeUrl(url: string): string {
  try {
    let urlToNormalize = url
    if (!urlToNormalize.startsWith("http://") && !urlToNormalize.startsWith("https://")) {
      urlToNormalize = "https://" + urlToNormalize
    }

    const urlObj = new URL(urlToNormalize)
    let normalized = urlObj.toString()

    if (normalized.endsWith("/")) {
      normalized = normalized.slice(0, -1)
    }

    const hostname = urlObj.hostname.toLowerCase()
    normalized = normalized.replace(urlObj.hostname, hostname)

    return normalized
  } catch (error) {
    console.error("Error normalizing URL:", error)
    return url.trim()
  }
}

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json()

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 })
    }

    let normalizedUrl: string
    try {
      let urlToParse = url
      if (!urlToParse.startsWith("http://") && !urlToParse.startsWith("https://")) {
        urlToParse = "https://" + urlToParse
      }

      const parsed = new URL(urlToParse)
      normalizedUrl = parsed.toString()

      if (normalizedUrl.endsWith("/")) {
        normalizedUrl = normalizedUrl.slice(0, -1)
      }
    } catch {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 })
    }

    // Fetch metadata
    let metadata = {}
    try {
      const metaResponse = await fetch(`${request.nextUrl.origin}/api/metadata`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: normalizedUrl }),
      })

      if (metaResponse.ok) {
        metadata = await metaResponse.json()
      }
    } catch (error) {
      console.error("Failed to fetch metadata:", error)
    }

    const shortCode = await createShortCode(normalizedUrl, metadata)

    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL ||
      (process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : `${request.nextUrl.protocol}//${request.nextUrl.host}`)

    return NextResponse.json({
      shortCode,
      shortUrl: `${baseUrl}/${shortCode}`,
      metadata,
    })
  } catch (error) {
    console.error("Error shortening URL:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
