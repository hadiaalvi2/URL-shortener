"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"

function useRemoveExtensionAttributes() {
  useEffect(() => {
    const buttons = document.querySelectorAll('button[fdprocessedid]');
    buttons.forEach(button => {
      button.removeAttribute('fdprocessedid');
    });
  }, []);
}

interface MetadataPreview {
  title?: string;
  description?: string;
  image?: string;
  favicon?: string;
}

export default function ShortenerPage() {
  const [url, setUrl] = useState("")
  const [shortUrl, setShortUrl] = useState("")
  const [loading, setLoading] = useState(false)
  const [origin, setOrigin] = useState("")
  const [metadata, setMetadata] = useState<MetadataPreview | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const { toast } = useToast()

  useRemoveExtensionAttributes();

  useEffect(() => {
    setOrigin(window.location.origin)
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const urlRegex = /^(https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|www\.[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9]+\.[^\s]{2,}|[a-zA-Z0-9]+\.[^\s]{2,})$/i;

    if (!url) {
      toast({
        title: "Error",
        description: "Please enter a URL.",
        variant: "destructive", 
      })
      return
    }

    if (!urlRegex.test(url)) {
      toast({
        title: "Error",
        description: "Please enter a valid URL (e.g., https://example.com).",
        variant: "destructive",
      })
      return
    }

    try {
      setLoading(true)
      setShortUrl("")
      setMetadata(null)

      const res = await fetch("/api/shorten", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      })

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to shorten URL");
      }

      const data = await res.json()
      const generatedShortUrl = `${origin}/${data.shortCode}`
      setShortUrl(generatedShortUrl)
      setMetadata(data.metadata)
      
      toast({
        title: "Success!",
        description: "URL shortened successfully with fresh metadata",
      })
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

  async function handleRefreshMetadata() {
    if (!shortUrl) return;

    try {
      setRefreshing(true)
      
      const shortCode = shortUrl.split('/').pop()
      const res = await fetch("/api/shorten", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, force: true }),
      })

      if (!res.ok) {
        throw new Error("Failed to refresh metadata");
      }

      const data = await res.json()
      setMetadata(data.metadata)
      
      toast({
        title: "Refreshed!",
        description: "Metadata updated with latest information",
      })
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to refresh metadata";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive", 
      })
    } finally {
      setRefreshing(false)
    }
  }

  async function handleCopy() {
    if (shortUrl) {
      await navigator.clipboard.writeText(shortUrl)
      toast({
        title: "Copied!",
        description: "Short link copied to clipboard",
      })
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4">
      <div className="w-full max-w-2xl space-y-6">
        <h1 className="text-3xl font-bold mb-6 text-center">URL Shortener</h1>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col md:flex-row gap-3 w-full"
        >
          <Input
            type="url"
            placeholder="Enter your long URL"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
            className="flex-1"
          />
          <Button type="submit" disabled={loading}>
            {loading ? "Shortening..." : "Shorten"}
          </Button>
        </form>

        {shortUrl && (
          <div className="space-y-4 p-6 bg-white rounded-lg border shadow-sm">
            <div className="flex flex-col gap-3">
              <p className="text-lg font-medium">
                Shortened URL:{" "}
                <a
                  href={shortUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 underline break-all"
                >
                  {shortUrl}
                </a>
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleCopy}>
                  Copy Link
                </Button>
                <Button 
                  variant="outline" 
                  onClick={handleRefreshMetadata}
                  disabled={refreshing}
                >
                  {refreshing ? "Refreshing..." : "Refresh Metadata"}
                </Button>
              </div>
            </div>

            {metadata && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <h3 className="text-lg font-semibold mb-3">Preview</h3>
                <div className="space-y-2">
                  {metadata.title && (
                    <div>
                      <span className="font-medium text-gray-600">Title:</span>
                      <p className="text-gray-900">{metadata.title}</p>
                    </div>
                  )}
                  {metadata.description && (
                    <div>
                      <span className="font-medium text-gray-600">Description:</span>
                      <p className="text-gray-700 text-sm">{metadata.description}</p>
                    </div>
                  )}
                  {metadata.image && (
                    <div>
                      <span className="font-medium text-gray-600">Image:</span>
                      <div className="mt-2">
                        <img 
                          src={metadata.image} 
                          alt="Preview" 
                          className="max-w-xs max-h-40 object-cover rounded border"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

       
      </div>
    </div>
  )
}