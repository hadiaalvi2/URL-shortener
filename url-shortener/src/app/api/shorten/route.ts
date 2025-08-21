import { NextResponse } from "next/server"
import { saveUrl } from "@/lib/url-store"

export async function POST(req: Request) {
  try {
    const { url } = await req.json()

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 })
    }

    
    let parsed: URL
    try {
      parsed = new URL(url)
    } catch {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 })
    }

    const shortCode = await saveUrl(parsed.toString())
    return NextResponse.json({ shortCode })
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 500 })
  }
}
