import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import * as cheerio from "cheerio"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export async function fetchPageMetadata(url: string) {
  try {
    const response = await fetch(url)
    const html = await response.text()
    const $ = cheerio.load(html)

    const title = $("head title").text()
    const description = $("meta[name='description']").attr("content") || $("meta[property='og:description']").attr("content")
    const image = $("meta[property='og:image']").attr("content") || $("meta[name='twitter:image']").attr("content")
    const favicon = $("link[rel='icon']").attr("href") || $("link[rel='shortcut icon']").attr("href")

    return {
      title: title || undefined,
      description: description || undefined,
      image: image || undefined,
      favicon: favicon ? new URL(favicon, url).toString() : undefined,
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