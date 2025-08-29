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

export default function ShortenerPage() {
  const [url, setUrl] = useState("")
  const [shortUrl, setShortUrl] = useState("")
  const [loading, setLoading] = useState(false)
  const [origin, setOrigin] = useState("")
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
      setShortUrl(`${origin}/${data.shortCode}`)
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
        // Ensure the document has focus before copying
        if (!document.hasFocus()) {
          window.focus();
        }
        
        await navigator.clipboard.writeText(shortUrl);
        toast({
          title: "Copied!",
          description: "Short link copied to clipboard",
        });
      } catch (error) {
        // Fallback to execCommand for older browsers or when clipboard API fails
        const textArea = document.createElement('textarea');
        textArea.value = shortUrl;
        document.body.appendChild(textArea);
        textArea.select();
        
        try {
          document.execCommand('copy');
          toast({
            title: "Copied!",
            description: "Short link copied to clipboard",
          });
        } catch (fallbackError) {
          toast({
            title: "Error",
            description: "Failed to copy to clipboard",
            variant: "destructive",
          });
        } finally {
          document.body.removeChild(textArea);
        }
      }
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4">
      <h1 className="text-3xl font-bold mb-6">URL Shortener</h1>

      <form
        onSubmit={handleSubmit}
        className="flex flex-col md:flex-row gap-3 w-full max-w-xl"
      >
        <Input
          type="url"
          placeholder="Enter your long URL"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          required
        />
        <Button type="submit" disabled={loading}>
          {loading ? "Shortening..." : "Shorten"}
        </Button>
      </form>

      {shortUrl && (
        <div className="mt-6 flex flex-col items-center gap-3">
          <p className="text-lg">
            Shortened URL:{" "}
            <a
              href={shortUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 underline"
            >
              {shortUrl}
            </a>
          </p>
          <Button variant="outline" onClick={handleCopy}>
            Copy
          </Button>
        </div>
      )}
    </div>
  )
}