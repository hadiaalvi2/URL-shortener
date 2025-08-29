"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Image from "next/image"

function useRemoveExtensionAttributes() {
  useEffect(() => {
    const buttons = document.querySelectorAll('button[fdprocessedid]');
    buttons.forEach(button => {
      button.removeAttribute('fdprocessedid');
    });
  }, []);
}

interface UrlMetadata {
  title?: string;
  description?: string;
  image?: string;
  favicon?: string;
  originalUrl?: string;
}

interface ShortenResponse {
  shortCode: string;
  metadata: UrlMetadata;
  refreshed?: boolean;
  created?: boolean;
}

export default function ShortenerPage() {
  const [url, setUrl] = useState("")
  const [shortUrl, setShortUrl] = useState("")
  const [metadata, setMetadata] = useState<UrlMetadata | null>(null)
  const [loading, setLoading] = useState(false)
  const [origin, setOrigin] = useState("")
  const { toast } = useToast()

  useRemoveExtensionAttributes();

  useEffect(() => {
    setOrigin(window.location.origin)
  }, [])

  async function handleSubmit(e: React.FormEvent, forceRefresh = false) {
    e.preventDefault()

    // Enhanced URL validation
    const urlRegex = /^(https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|www\.[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9]+\.[^\s]{2,}|[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]*\.[a-zA-Z]{2,})$/i;

    if (!url.trim()) {
      toast({
        title: "Error",
        description: "Please enter a URL.",
        variant: "destructive", 
      })
      return
    }

    const trimmedUrl = url.trim();
    if (!urlRegex.test(trimmedUrl)) {
      toast({
        title: "Error",
        description: "Please enter a valid URL (e.g., https://example.com or example.com).",
        variant: "destructive",
      })
      return
    }

    try {
      setLoading(true)
      
      if (forceRefresh) {
        setShortUrl("")
        setMetadata(null)
      }

      const res = await fetch("/api/shorten", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          url: trimmedUrl,
          force: forceRefresh 
        }),
      })

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to shorten URL");
      }

      const data: ShortenResponse = await res.json()
      const newShortUrl = `${origin}/${data.shortCode}`
      
      setShortUrl(newShortUrl)
      setMetadata(data.metadata)

      // Show appropriate success message
      if (forceRefresh && data.refreshed) {
        toast({
          title: "Metadata Refreshed!",
          description: "The link preview has been updated with fresh content.",
        })
      } else if (data.created) {
        toast({
          title: "Success!",
          description: "Your URL has been shortened successfully.",
        })
      } else {
        toast({
          title: "Link Retrieved!",
          description: "Found existing short link for this URL.",
        })
      }
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Something went wrong while shortening the URL";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive", 
      })
    } finally {
      setLoading(false)
    }
  }

  async function handleCopy() {
    if (shortUrl) {
      try {
        await navigator.clipboard.writeText(shortUrl)
        toast({
          title: "Copied!",
          description: "Short link copied to clipboard",
        })
      } catch {
        // Fallback for browsers that don't support clipboard API
        const textArea = document.createElement('textarea');
        textArea.value = shortUrl;
        document.body.appendChild(textArea);
        textArea.select();
        try {
          document.execCommand('copy');
          toast({
            title: "Copied!",
            description: "Short link copied to clipboard",
          })
        } catch {
          toast({
            title: "Copy Failed",
            description: "Please copy the link manually",
            variant: "destructive",
          })
        }
        document.body.removeChild(textArea);
      }
    }
  }

  async function handleRefresh() {
    if (url && shortUrl) {
      // Create a synthetic event to pass to handleSubmit
      const syntheticEvent = {
        preventDefault: () => {},
      } as React.FormEvent;
      
      await handleSubmit(syntheticEvent, true);
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="w-full max-w-2xl space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">URL Shortener</h1>
          <p className="text-gray-600">
            Transform long URLs into short, shareable links with rich previews
          </p>
        </div>

        <Card className="bg-white/80 backdrop-blur-sm border-gray-200/50">
          <CardHeader>
            <CardTitle>Shorten Your URL</CardTitle>
            <CardDescription>
              Enter a URL to create a shortened link with automatic metadata extraction
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-4">
              <div className="flex flex-col md:flex-row gap-3">
                <Input
                  type="text"
                  placeholder="Enter your long URL (e.g., https://example.com)"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  required
                  className="flex-1"
                  disabled={loading}
                />
                <Button 
                  type="submit" 
                  disabled={loading}
                  className="whitespace-nowrap"
                >
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Processing...
                    </div>
                  ) : (
                    "Shorten"
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {shortUrl && (
          <Card className="bg-white/90 backdrop-blur-sm border-green-200/50 border-2">
            <CardHeader>
              <CardTitle className="text-green-800">✓ Short URL Created</CardTitle>
              <CardDescription>
                Your shortened URL is ready to share
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col md:flex-row gap-3 items-center">
                <div className="flex-1 min-w-0">
                  <a
                    href={shortUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 underline break-all text-lg font-medium"
                  >
                    {shortUrl}
                  </a>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button variant="outline" onClick={handleCopy}>
                    Copy
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={handleRefresh}
                    disabled={loading}
                    title="Refresh metadata"
                  >
                    {loading ? "..." : "↻"}
                  </Button>
                </div>
              </div>

              {metadata && (
                <div className="mt-6 p-4 bg-gray-50 rounded-lg border">
                  <h3 className="font-semibold text-gray-800 mb-3">Link Preview</h3>
                  
                  <div className="flex items-start space-x-4">
                    {/* Favicon */}
                    {metadata.favicon && (
                      <div className="shrink-0">
                        <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center shadow-sm border">
                          <Image
                            src={metadata.favicon}
                            alt="Site favicon"
                            width={24}
                            height={24}
                            className="object-contain"
                            unoptimized={!metadata.favicon.startsWith(origin)}
                            onError={(e) => {
                              const target = e.currentTarget as HTMLImageElement;
                              target.src = '/favicon.ico';
                            }}
                          />
                        </div>
                      </div>
                    )}
                    
                    <div className="flex-1 min-w-0">
                      {/* Title */}
                      <h4 className="font-semibold text-gray-900 mb-1 truncate">
                        {metadata.title || 'No title available'}
                      </h4>
                      
                      {/* Description */}
                      {metadata.description && (
                        <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                          {metadata.description}
                        </p>
                      )}
                      
                      {/* Original URL */}
                      <p className="text-xs text-gray-500 truncate">
                        {metadata.originalUrl || url}
                      </p>
                    </div>
                    
                    {/* Preview Image */}
                    {metadata.image && !metadata.image.includes('favicons') && (
                      <div className="shrink-0">
                        <div className="w-20 h-20 bg-gray-200 rounded-lg overflow-hidden border">
                          <Image
                            src={metadata.image}
                            alt="Site preview"
                            width={80}
                            height={80}
                            className="w-full h-full object-cover"
                            unoptimized={!metadata.image.startsWith(origin)}
                            onError={(e) => {
                              const target = e.currentTarget as HTMLImageElement;
                              target.style.display = 'none';
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <div className="text-center text-sm text-gray-500">
          <p>
            Free URL shortening service with automatic metadata extraction for better link previews
          </p>
        </div>
      </div>
    </div>
  )
}