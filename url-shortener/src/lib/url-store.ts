import { supabase } from "./supabase"

export interface UrlData {
  originalUrl: string
  title?: string
  description?: string
  image?: string
  favicon?: string
  createdAt: number
  [key: string]: unknown
}

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

export async function createShortCode(url: string, metadata?: Partial<UrlData>): Promise<string> {
  if (!url || typeof url !== "string") {
    throw new Error("Invalid URL provided")
  }

  const normalizedUrl = normalizeUrl(url)

  const { data: existingUrls, error: searchError } = await supabase
    .from("urls")
    .select("short_code")
    .eq("original_url", normalizedUrl)
    .limit(1)

  if (searchError) {
    console.error("Error searching for existing URL:", searchError)
  } else if (existingUrls && existingUrls.length > 0) {
    return existingUrls[0].short_code
  }

  let shortCode: string
  let attempts = 0

  do {
    shortCode = Math.random().toString(36).substring(2, 10)
    attempts++

    if (attempts > 10) {
      throw new Error("Failed to generate unique short code")
    }

    const { data: existing } = await supabase.from("urls").select("short_code").eq("short_code", shortCode).limit(1)

    if (!existing || existing.length === 0) {
      break
    }
  } while (attempts <= 10)

  const { error } = await supabase.from("urls").insert({
    short_code: shortCode,
    original_url: normalizedUrl,
    title: metadata?.title,
    description: metadata?.description,
    image: metadata?.image,
    favicon: metadata?.favicon,
    created_at: new Date().toISOString(),
  })

  if (error) {
    console.error("Error storing URL:", error)
    throw new Error("Failed to store URL")
  }

  return shortCode
}

export async function getUrl(shortCode: string): Promise<string | null> {
  const { data, error } = await supabase.from("urls").select("original_url").eq("short_code", shortCode).limit(1)

  if (error) {
    console.error("Error fetching URL:", error)
    return null
  }

  return data && data.length > 0 ? data[0].original_url : null
}

export async function getUrlData(shortCode: string): Promise<UrlData | undefined> {
  const { data, error } = await supabase.from("urls").select("*").eq("short_code", shortCode).limit(1)

  if (error) {
    console.error("Error fetching URL data:", error)
    return undefined
  }

  if (!data || data.length === 0) {
    return undefined
  }

  const row = data[0]
  return {
    originalUrl: row.original_url,
    title: row.title,
    description: row.description,
    image: row.image,
    favicon: row.favicon,
    createdAt: new Date(row.created_at).getTime(),
  }
}

export async function getAllUrls(): Promise<{ shortCode: string; originalUrl: string }[]> {
  const { data, error } = await supabase.from("urls").select("short_code, original_url")

  if (error) {
    console.error("Error fetching all URLs:", error)
    return []
  }

  return data.map((row) => ({
    shortCode: row.short_code,
    originalUrl: row.original_url,
  }))
}
