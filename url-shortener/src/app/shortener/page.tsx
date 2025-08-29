"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"

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
  const [copied, setCopied] = useState(false)
  const { toast } = useToast()

  useRemoveExtensionAttributes();

  useEffect(() => {
    // Check if we're in the browser environment before accessing window
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin)
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    // Improved URL regex pattern
    const urlRegex = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/i;

    if (!url) {
      toast({
        title: "Please enter a URL",
        description: "We need a URL to shorten it for you.",
        variant: "destructive", 
      })
      return
    }

    // Add https:// if missing
    let processedUrl = url;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      processedUrl = `https://${url}`;
    }

    if (!urlRegex.test(processedUrl)) {
      toast({
        title: "Invalid URL format",
        description: "Please enter a valid URL (e.g., example.com or https://example.com).",
        variant: "destructive",
      })
      return
    }

    try {
      setLoading(true)
      setShortUrl("")
      setCopied(false)

      const res = await fetch("/api/shorten", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: processedUrl }),
      })

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to shorten URL");
      }

      const data = await res.json()
      const newShortUrl = `${origin}/${data.shortCode}`
      setShortUrl(newShortUrl)
      
      toast({
        title: "URL shortened successfully!",
        description: "Your short link is ready to share.",
      })

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Something went wrong while shortening the URL";
      toast({
        title: "Oops! Something went wrong",
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
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
        toast({
          title: "Copied to clipboard!",
          description: "Your short link is ready to paste.",
        })
      } catch (err) {
        toast({
          title: "Failed to copy",
          description: "Please try again or copy manually.",
          variant: "destructive",
        })
      }
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
      {/* Navigation */}
      <nav className="border-b border-gray-100 bg-white/80 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center space-x-2 hover:opacity-80 transition-opacity">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
              </div>
              <span className="text-xl font-bold text-gray-900">LinkShrink</span>
            </Link>
            
            <div className="text-sm text-gray-500 flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Free & secure URL shortener
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center p-2 bg-white border border-gray-200 rounded-full shadow-sm mb-6">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            </div>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Shorten Your Long Links
          </h1>
          <p className="text-lg text-gray-600 max-w-xl mx-auto">
            Create shortened URLs that are perfect for social media, messaging, and anywhere you share links.
          </p>
        </div>

        {/* URL Shortener Form */}
        <div className="max-w-2xl mx-auto">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <Input
                  type="url"
                  placeholder="Paste your long URL here (e.g., https://example.com/very-long-url)..."
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="h-14 text-lg px-6 border-2 border-gray-200 focus:border-blue-500 transition-colors shadow-sm"
                  required
                  aria-label="URL to shorten"
                />
              </div>
              <Button 
                type="submit" 
                disabled={loading}
                className="h-14 px-8 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-lg transition-all duration-200 hover:shadow-md disabled:hover:scale-100"
                aria-label={loading ? "Shortening URL" : "Shorten URL"}
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" aria-hidden="true"></div>
                    Shortening...
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Shorten URL
                  </div>
                )}
              </Button>
            </div>
            
            {url && (
              <div className="text-xs text-green-600 text-left flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                URL looks valid and ready to shorten
              </div>
            )}
          </form>

          {/* Result */}
          {shortUrl && (
            <div className="mt-8 space-y-4 animate-fade-in">
              <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                <div className="flex flex-col md:flex-row items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <span className="text-sm font-medium text-green-700">Your short link is ready!</span>
                    </div>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 flex items-center justify-between">
                      <a
                        href={shortUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 font-mono text-lg break-all transition-colors"
                      >
                        {shortUrl}
                      </a>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={handleCopy}
                        className={`ml-2 transition-all duration-200 ${
                          copied 
                            ? 'bg-green-100 text-green-700' 
                            : 'hover:bg-gray-100'
                        }`}
                        aria-label="Copy short URL"
                      >
                        {copied ? (
                          <div className="flex items-center gap-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Copied!
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                            </svg>
                            Copy
                          </div>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Share Options */}
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <h4 className="text-sm font-medium text-gray-900 mb-3">Share via:</h4>
                  <div className="flex flex-wrap gap-2">
                    {/* WhatsApp */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(`https://wa.me/?text=Check this out: ${shortUrl}`, '_blank')}
                      className="gap-2 bg-white hover:bg-green-50 border-green-200 text-green-700"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.864 3.49"/>
                      </svg>
                      WhatsApp
                    </Button>

                    {/* Twitter */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(`https://twitter.com/intent/tweet?text=Check this out: ${shortUrl}`, '_blank')}
                      className="gap-2 bg-white hover:bg-blue-50 border-blue-200 text-blue-700"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                      </svg>
                      Twitter
                    </Button>

                    {/* Facebook */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(`https://www.facebook.com/sharer/sharer.php?u=${shortUrl}`, '_blank')}
                      className="gap-2 bg-white hover:bg-indigo-50 border-indigo-200 text-indigo-700"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                      </svg>
                      Facebook
                    </Button>

                    {/* LinkedIn */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${shortUrl}`, '_blank')}
                      className="gap-2 bg-white hover:bg-blue-50 border-blue-200 text-blue-700"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                      </svg>
                      LinkedIn
                    </Button>

                    {/* Email */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(`mailto:?body=Check this out: ${shortUrl}`, '_blank')}
                      className="gap-2 bg-white hover:bg-gray-50 border-gray-200 text-gray-700"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      Email
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Quick Stats */}
          {shortUrl && (
            <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                <div className="text-2xl font-bold text-blue-600">0</div>
                <div className="text-xs text-gray-500">Total Clicks</div>
              </div>
              <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                <div className="text-2xl font-bold text-green-600">100%</div>
                <div className="text-xs text-gray-500">Link Safety</div>
              </div>
              <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                <div className="text-2xl font-bold text-purple-600">∞</div>
                <div className="text-xs text-gray-500">Never Expires</div>
              </div>
              <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                <div className="text-2xl font-bold text-orange-600">0</div>
                <div className="text-xs text-gray-500">QR Scans</div>
              </div>
            </div>
          )}
        </div>

        
      </main>    
    </div>
  )
}