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
      
      toast({
        title: "Success!",
        description: "Your URL has been shortened successfully.",
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

  async function handleCopy() {
    if (shortUrl) {
      await navigator.clipboard.writeText(shortUrl)
      toast({
        title: "Copied!",
        description: "Short link copied to clipboard",
      })
    }
  }

  const shareToWhatsApp = () => {
    if (shortUrl) {
      const message = encodeURIComponent(`Check this out: ${shortUrl}`)
      window.open(`https://wa.me/?text=${message}`, '_blank')
    }
  }

  const shareToFacebook = () => {
    if (shortUrl) {
      const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shortUrl)}`
      window.open(fbUrl, '_blank', 'width=600,height=400')
    }
  }

  const shareToTwitter = () => {
    if (shortUrl) {
      const text = encodeURIComponent('Check this out!')
      const twitterUrl = `https://twitter.com/intent/tweet?text=${text}&url=${encodeURIComponent(shortUrl)}`
      window.open(twitterUrl, '_blank', 'width=600,height=400')
    }
  }

  const shareToLinkedIn = () => {
    if (shortUrl) {
      const linkedInUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shortUrl)}`
      window.open(linkedInUrl, '_blank', 'width=600,height=400')
    }
  }

  const shareToTelegram = () => {
    if (shortUrl) {
      const message = encodeURIComponent(`Check this out: ${shortUrl}`)
      const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(shortUrl)}&text=${message}`
      window.open(telegramUrl, '_blank')
    }
  }

  const shareViaEmail = () => {
    if (shortUrl) {
      const subject = encodeURIComponent('Check out this link')
      const body = encodeURIComponent(`I thought you might find this interesting: ${shortUrl}`)
      window.location.href = `mailto:?subject=${subject}&body=${body}`
    }
  }

  return (
    <div className="min-h-screen py-12 px-4 relative">
      <div className="max-w-4xl mx-auto relative z-10">
        
        {/* Header */}
        <div className="text-center mb-12">
          <Link href="/" className="inline-flex items-center text-white hover:text-blue-200 mb-6 group">
            <svg className="w-5 h-5 mr-2 group-hover:-translate-x-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Home
          </Link>
          
          <h1 className="text-5xl font-bold text-white mb-4">
            Create Your <span className="text-blue-300">Short Link</span>
          </h1>
          
        </div>

        {/* Main Form Card */}
        <div className="bg-white/10 backdrop-blur-sm rounded-3xl shadow-xl border border-white/20 p-8 md:p-12 mb-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-3">
              <label htmlFor="url-input" className="block text-lg font-semibold text-white">
                Enter your long URL
              </label>
              <div className="relative">
                <Input
                  id="url-input"
                  type="url"
                  placeholder="https://example.com/very/long/url/that/needs/shortening"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="text-lg p-6 pr-32 rounded-2xl border-2 border-white/30 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 bg-white/90"
                  required
                />
                <Button 
                  type="submit" 
                  disabled={loading}
                  className="absolute right-2 top-2 bottom-2 px-8 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-all duration-200"
                >
                  {loading ? (
                    <div className="flex items-center space-x-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Processing...</span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2">
                      <span>Shorten</span>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                  )}
                </Button>
              </div>
              
            </div>
          </form>
        </div>

        {/* Result Card */}
        {shortUrl && (
          <div className="bg-white/10 backdrop-blur-sm rounded-3xl shadow-xl border border-white/20 p-8 md:p-12 animate-in slide-in-from-bottom duration-500">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100/20 backdrop-blur-sm rounded-full mb-4">
                <svg className="w-8 h-8 text-green-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-3xl font-bold text-white mb-2">Your Short Link is Ready!</h2>
              <p className="text-white/80">Share it anywhere with beautiful previews</p>
            </div>

            {/* Short URL Display */}
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 mb-8">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex-1 min-w-0">
                  <label className="block text-sm font-medium text-white/80 mb-2">Your shortened URL:</label>
                  <a
                    href={shortUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-300 hover:text-blue-200 text-lg font-medium break-all hover:underline transition-colors duration-200"
                  >
                    {shortUrl}
                  </a>
                </div>
                <Button 
                  onClick={handleCopy}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-semibold transition-all duration-200 hover:scale-105"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Copy Link
                </Button>
              </div>
            </div>

            {/* Social Sharing Section */}
            <div className="space-y-6">
              <div className="text-center">
                <h3 className="text-xl font-bold text-white mb-2">Share Directly</h3>
                <p className="text-white/80">Click to share your short link instantly</p>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {/* WhatsApp */}
                <Button
                  onClick={shareToWhatsApp}
                  className="bg-green-500 hover:bg-green-600 text-white p-4 rounded-2xl transition-all duration-200 hover:scale-105 hover:shadow-lg flex flex-col items-center space-y-2 group relative overflow-hidden h-20"
                >
                  <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity duration-200"></div>
                  <div className="relative flex justify-center items-center w-6 h-6 flex-shrink-0">
                    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.150-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.050-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.520.074-.792.372-.272.297-1.040 1.016-1.040 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.200 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.360.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.640 0 5.122 1.030 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.703"/>
                    </svg>
                  </div>
                  <span className="text-xs font-medium relative">WhatsApp</span>
                </Button>

                {/* Facebook */}
                <Button
                  onClick={shareToFacebook}
                  className="bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-2xl transition-all duration-200 hover:scale-105 hover:shadow-lg flex flex-col items-center space-y-2 group relative overflow-hidden h-20"
                >
                  <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity duration-200"></div>
                  <div className="relative flex justify-center items-center w-6 h-6 flex-shrink-0">
                    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                    </svg>
                  </div>
                  <span className="text-xs font-medium relative">Facebook</span>
                </Button>

                {/* Twitter/X */}
                <Button
                  onClick={shareToTwitter}
                  className="bg-black hover:bg-gray-800 text-white p-4 rounded-2xl transition-all duration-200 hover:scale-105 hover:shadow-lg flex flex-col items-center space-y-2 group relative overflow-hidden h-20"
                >
                  <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity duration-200"></div>
                  <div className="relative flex justify-center items-center w-6 h-6 flex-shrink-0">
                    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                    </svg>
                  </div>
                  <span className="text-xs font-medium relative">Twitter</span>
                </Button>

                {/* LinkedIn */}
                <Button
                  onClick={shareToLinkedIn}
                  className="bg-blue-700 hover:bg-blue-800 text-white p-4 rounded-2xl transition-all duration-200 hover:scale-105 hover:shadow-lg flex flex-col items-center space-y-2 group relative overflow-hidden h-20"
                >
                  <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity duration-200"></div>
                  <div className="relative flex justify-center items-center w-6 h-6 flex-shrink-0">
                    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                    </svg>
                  </div>
                  <span className="text-xs font-medium relative">LinkedIn</span>
                </Button>

                {/* Telegram */}
                <Button
                  onClick={shareToTelegram}
                  className="bg-blue-500 hover:bg-blue-600 text-white p-4 rounded-2xl transition-all duration-200 hover:scale-105 hover:shadow-lg flex flex-col items-center space-y-2 group relative overflow-hidden h-20"
                >
                  <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity duration-200"></div>
                  <div className="relative flex justify-center items-center w-6 h-6 flex-shrink-0">
                    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.140.141-.259.259-.374.261l.213-3.053 5.56-5.022c.24-.213-.054-.334-.373-.121l-6.869 4.326-2.96-.924c-.640-.203-.658-.640.136-.954l11.566-4.458c.538-.196 1.006.128.832.941z"/>
                    </svg>
                  </div>
                  <span className="text-xs font-medium relative">Telegram</span>
                </Button>

                {/* Email */}
                <Button
                  onClick={shareViaEmail}
                  className="bg-gray-600 hover:bg-gray-700 text-white p-4 rounded-2xl transition-all duration-200 hover:scale-105 hover:shadow-lg flex flex-col items-center space-y-2 group relative overflow-hidden h-20"
                >
                  <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity duration-200"></div>
                  <div className="relative flex justify-center items-center w-6 h-6 flex-shrink-0">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <span className="text-xs font-medium relative">Email</span>
                </Button>
              </div>

              {/* Additional Actions */}
              <div className="mt-8 pt-6 border-t border-white/20">
                <div className="flex flex-col md:flex-row items-center justify-center gap-4">
                  <Button
                    onClick={() => {
                      setUrl("");
                      setShortUrl("");
                    }}
                    variant="outline"
                    className="px-6 py-3 rounded-xl font-semibold border-2 border-white/30 hover:border-blue-500 hover:text-blue-300 text-black transition-all duration-200"
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Create Another Link
                  </Button>
                  
                  <Button
                    onClick={() => window.open(shortUrl, '_blank')}
                    variant="outline"
                    className="px-6 py-3 rounded-xl font-semibold border-2 border-white/30 hover:border-green-500 hover:text-green-300 text-black transition-all duration-200"
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    Test Your Link
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Features Preview */}
        {!shortUrl && (
          <div className="bg-white/10 backdrop-blur-sm rounded-3xl border border-white/20 p-8 md:p-12">
            <h2 className="text-3xl font-bold text-white text-center mb-8">
              Why Use Our URL Shortener?
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                {
                  icon: (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  ),
                  title: "Instant Results",
                  desc: "Get your short link in seconds"
                },
                {
                  icon: (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  ),
                  title: "Rich Previews",
                  desc: "Beautiful previews with images and text"
                },
                {
                  icon: (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  ),
                  title: "Easy Sharing",
                  desc: "One-click sharing to all platforms"
                },
                {
                  icon: (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 01112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  ),
                  title: "Reliable",
                  desc: "99.9% uptime guarantee"
                }
              ].map((feature, idx) => (
                <div key={idx} className="text-center group">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-100/20 to-blue-200/20 backdrop-blur-sm rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                    <svg className="w-8 h-8 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      {feature.icon}
                    </svg>
                  </div>
                  <h3 className="font-bold text-lg text-black mb-2">{feature.title}</h3>
                  <p className="text-black/80 text-sm">{feature.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center pt-8">
          <p className="text-white/70 text-sm">
            Free • No Registration • Unlimited Links • Rich Previews
          </p>
        </div>
      </div>
    </div>
  );
}
