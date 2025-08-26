import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import * as cheerio from "cheerio"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export async function fetchPageMetadata(url: string) {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000) // 5 second timeout

    const response = await fetch(url, { signal: controller.signal })
    clearTimeout(timeoutId)
    const html = await response.text()
    const $ = cheerio.load(html)

    const title = $("head title").text()
    const description = $("meta[name='description']").attr("content") || $("meta[property='og:description']").attr("content")
    const image = $("meta[property='og:image']").attr("content") || $("meta[name='twitter:image']").attr("content")
    let favicon = $("link[rel='icon']").attr("href") || $("link[rel='shortcut icon']").attr("href")

    if (favicon) {
      try {
        if (favicon.startsWith('//')) {
          favicon = `https:${favicon}`
        } else if (!favicon.startsWith('http')) {
          const baseUrl = new URL(url)
          favicon = new URL(favicon, baseUrl).toString()
        }
      } catch (e) {
        favicon = undefined
      }
    }

    return {
      title: title || undefined,
      description: description || undefined,
      image: image || undefined,
      favicon: favicon || undefined,
    }
  } catch (error) {
    console.error(`Error fetching metadata for ${url}:`, error)
    return {
      title: undefined,
      description: undefined,
      image: undefined,
      favicon: undefined,
    }
  }
}