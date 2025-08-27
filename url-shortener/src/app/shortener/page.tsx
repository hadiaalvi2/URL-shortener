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

  // Simple client-side URL validation
  function isValidUrl(url: string): boolean {
    try {
      const testUrl = url.startsWith('http') ? url : `https://${url}`;
      const urlObj = new URL(testUrl);
      return ['http:', 'https:'].includes(urlObj.protocol) && 
             urlObj.hostname.includes('.') && 
             urlObj.hostname.length > 3;
    } catch {
      return false;
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const trimmedUrl = url.trim();

    // Client-side validation
    if (!trimmedUrl) {
      toast({
        title: "Error",
        description: "Please enter a URL.",
        variant: "destructive", 
      })
      return
    }

    if (!isValidUrl(trimmedUrl)) {
      toast({
        title: "Error",
        description: "Please enter a valid URL (e.g., https://example.com or example.com).",
        variant: "destructive",
      })
      return
    }

    try {
      setLoading(true)
      setShortUrl("")

      console.log('Submitting URL:', trimmedUrl);

      const response = await fetch("/api/shorten", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: trimmedUrl }),
      })

      const data = await response.json();
      console.log('API response:', data);

      if (!response.ok) {
        throw new Error(data.error || `Server error: ${response.status}`);
      }

      if (!data.shortCode) {
        throw new Error("No short code received from server");
      }

      const generatedShortUrl = `${origin}/${data.shortCode}`;
      setShortUrl(generatedShortUrl);
      
      toast({
        title: "Success!",
        description: "Your URL has been shortened successfully.",
      })

    } catch (error: unknown) {
      console.error('Shortening error:', error);
      
      let errorMessage = "Something went wrong while shortening the URL";
      
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }

      // Handle network errors
      if (errorMessage.includes('fetch')) {
        errorMessage = "Network error. Please check your connection and try again.";
      }

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
    if (!shortUrl) return;
    
    try {
      await navigator.clipboard.writeText(shortUrl)
      toast({
        title: "Copied!",
        description: "Short link copied to clipboard",
      })
    } catch (error) {
      console.error('Copy failed:', error);
      toast({
        title: "Copy failed",
        description: "Please copy the link manually",
        variant: "destructive",
      })
    }
  }

  function handleTest() {
    if (!shortUrl) return;
    window.open(shortUrl, '_blank');
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="w-full max-w-2xl space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">URL Shortener</h1>
          <p className="text-gray-600">Transform your long URLs into short, shareable links</p>
        </div>

        {/* Form */}
        <div className="bg-white p-6 rounded-lg shadow-lg">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="url-input" className="block text-sm font-medium text-gray-700 mb-2">
                Enter your URL
              </label>
              <Input
                id="url-input"
                type="text"
                placeholder="https://example.com or example.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={loading}
                className="w-full"
                required
              />
            </div>
            
            <Button 
              type="submit" 
              disabled={loading || !url.trim()}
              className="w-full"
            >
              {loading ? "Shortening..." : "Shorten URL"}
            </Button>
          </form>

          {/* Result */}
          {shortUrl && (
            <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Your shortened URL:
                  </label>
                  <div className="flex items-center space-x-2">
                    <Input
                      value={shortUrl}
                      readOnly
                      className="flex-1 bg-white"
                      onClick={(e) => e.currentTarget.select()}
                    />
                  </div>
                </div>
                
                <div className="flex space-x-2">
                  <Button 
                    variant="outline" 
                    onClick={handleCopy}
                    className="flex-1"
                  >
                    Copy Link
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={handleTest}
                    className="flex-1"
                  >
                    Test Link
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="text-center text-sm text-gray-500">
          <p>Enter any valid URL and we'll create a short link for easy sharing.</p>
          <p className="mt-1">Supports: websites, YouTube, social media links, and more!</p>
        </div>
      </div>
    </div>
  )
}