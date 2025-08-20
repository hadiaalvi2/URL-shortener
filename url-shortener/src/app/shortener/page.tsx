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

  useRemoveExtensionAttributes(); // Add this hook

  useEffect(() => {
    setOrigin(window.location.origin)
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!url) {
      toast({
        title: "Error",
        description: "Please enter a valid URL",
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
        throw new Error("Failed to shorten URL")
      }

      const data = await res.json()
      setShortUrl(`${origin}/${data.shortCode}`)
    } catch (error) {
      toast({
        title: "Error",
        description: "Something went wrong while shortening the URL",
        variant: "destructive", 
      })
    } finally {
      setLoading(false)
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