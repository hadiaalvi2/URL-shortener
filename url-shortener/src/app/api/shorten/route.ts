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

    // Extract metadata from the URL
    const metadata = await extractMetadata(url)
    
    // Save URL with metadata
    const shortCode = await saveUrl(parsed.toString(), metadata)
    
    return NextResponse.json({ 
      shortCode,
      metadata: {
        title: metadata.title,
        description: metadata.description,
        image: metadata.image,
        favicon: metadata.favicon
      }
    })
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 500 })
  }
}

// Function to extract metadata from a URL
async function extractMetadata(url: string): Promise<{
  title?: string;
  description?: string;
  image?: string;
  favicon?: string;
}> {
  try {
    // For demo purposes, we'll simulate fetching metadata
    // In a real implementation, you would fetch the page HTML and parse it
    
    const hostname = new URL(url).hostname;
    
    // Simulate different metadata based on the domain
    if (hostname.includes('netlify.com') || hostname.includes('netlify.app')) {
      return {
        title: 'Netlify - Deploy your websites with ease',
        description: 'Netlify is the modern way to deploy your websites with continuous deployment, serverless functions, and more.',
        image: 'https://www.netlify.com/v3/img/build-dynamic-websites/netlify-cms.png',
        favicon: 'https://www.netlify.com/v3/static/favicon/favicon-32x32.png'
      };
    }
    
    if (hostname.includes('bbc.com') || hostname.includes('bbc.co.uk')) {
      return {
        title: 'Labubu maker\'s profits soar by 40% as collectibles demand grows',
        description: 'Pop Mart, the Chinese company which makes the toothy-grinned toys, is seeing massive growth in the collectibles market.',
        image: 'https://ichef.bbci.co.uk/news/1024/branded_news/13D5/production/_130499835_popmart.jpg',
        favicon: 'https://www.bbc.com/favicon.ico'
      };
    }
    
    if (hostname.includes('zimo.ws')) {
      return {
        title: 'ZIMO - URL Shortener Service',
        description: 'Shorten your long URLs with ZIMO',
        favicon: 'https://zimo.ws/favicon.ico'
      };
    }
    
    // Default metadata for other sites
    return {
      title: `Page from ${hostname}`,
      description: 'Check out this shared link',
      favicon: `${new URL(url).origin}/favicon.ico`
    };
  } catch (error) {
    console.error('Error extracting metadata:', error);
    return {};
  }
}