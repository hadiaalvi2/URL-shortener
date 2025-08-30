"use client"

import React, { useState } from 'react'
import { useHistory } from '../contexts/history-context'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import Image from 'next/image'

interface HistorySidebarProps {
  isOpen: boolean
  onToggle: () => void
}

export function HistorySidebar({ isOpen, onToggle }: HistorySidebarProps) {
  const { state, removeItem, clearHistory } = useHistory()
  const { toast } = useToast()
  const [showConfirmClear, setShowConfirmClear] = useState(false)
  const [expandedItem, setExpandedItem] = useState<string | null>(null)

  const handleCopyUrl = async (shortUrl: string) => {
    try {
      await navigator.clipboard.writeText(shortUrl)
      toast({
        title: "Copied!",
        description: "Short link copied to clipboard"
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy link",
        variant: "destructive"
      })
    }
  }

  const handleRemoveItem = (id: string) => {
    removeItem(id)
    toast({
      title: "Removed",
      description: "Link removed from history"
    })
  }

  const handleClearHistory = () => {
    clearHistory()
    setShowConfirmClear(false)
    toast({
      title: "Cleared",
      description: "History cleared successfully"
    })
  }

  const shareToWhatsApp = (shortUrl: string) => {
    const message = encodeURIComponent(`Check this out: ${shortUrl}`)
    window.open(`https://wa.me/?text=${message}`, '_blank')
  }

  const shareToTwitter = (shortUrl: string) => {
    const text = encodeURIComponent('Check this out!')
    const twitterUrl = `https://twitter.com/intent/tweet?text=${text}&url=${encodeURIComponent(shortUrl)}`
    window.open(twitterUrl, '_blank', 'width=600,height=400')
  }

  const shareToFacebook = (shortUrl: string) => {
    const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shortUrl)}`
    window.open(fbUrl, '_blank', 'width=600,height=400')
  }

  const shareToLinkedIn = (shortUrl: string) => {
    const linkedInUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shortUrl)}`
    window.open(linkedInUrl, '_blank', 'width=600,height=400')
  }

  const shareToTelegram = (shortUrl: string) => {
    const message = encodeURIComponent(`Check this out: ${shortUrl}`)
    const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(shortUrl)}&text=${message}`
    window.open(telegramUrl, '_blank')
  }

  const shareViaEmail = (shortUrl: string) => {
    const subject = encodeURIComponent('Check out this link')
    const body = encodeURIComponent(`I thought you might find this interesting: ${shortUrl}`)
    window.location.href = `mailto:?subject=${subject}&body=${body}`
  }

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))
    
    if (diffInMinutes < 1) {
      return "Just now"
    } else if (diffInMinutes < 60) {
      return `${diffInMinutes}m ago`
    } else if (diffInMinutes < 1440) { // Less than 24 hours
      const hours = Math.floor(diffInMinutes / 60)
      return `${hours}h ago`
    } else if (diffInMinutes < 2880) { // Less than 48 hours
      return "1d ago"
    } else {
      const days = Math.floor(diffInMinutes / 1440)
      return days < 7 ? `${days}d ago` : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }
  }

  const getDomainFromUrl = (url: string) => {
    try {
      const domain = new URL(url).hostname.replace('www.', '')
      return domain
    } catch {
      return url
    }
  }

  const toggleExpanded = (itemId: string) => {
    setExpandedItem(expandedItem === itemId ? null : itemId)
  }

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={onToggle}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed top-0 right-0 h-full w-80 bg-black/80 backdrop-blur-xl border-l border-white/10 
        transform transition-transform duration-300 ease-out z-50
        ${isOpen ? 'translate-x-0' : 'translate-x-full'}
      `}>
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-white/10">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-white">Recent</h2>
            </div>
            
            <div className="flex items-center gap-2">
              {state.items.length > 0 && (
                <Button
                  onClick={() => setShowConfirmClear(true)}
                  variant="ghost"
                  size="sm"
                  className="text-white/80 hover:text-white hover:bg-white/10 p-2 h-10 w-10"
                  title="Clear all"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </Button>
              )}
              
              <Button
                onClick={onToggle}
                variant="ghost"
                size="sm"
                className="text-white/80 hover:text-white hover:bg-white/10 p-2 h-10 w-10"
                title="Close"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </Button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {state.items.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                </div>
                <h3 className="text-white font-medium mb-2">No links yet</h3>
                <p className="text-white/60 text-sm leading-relaxed">
                  Your shortened links will appear here for easy access and sharing
                </p>
              </div>
            ) : (
              <div className="p-2">
                {state.items.map((item, index) => (
                  <div
                    key={item.id}
                    className={`group relative mb-2 rounded-lg bg-white/5 hover:bg-white/10 transition-all duration-200 border border-transparent hover:border-white/10 ${
                      expandedItem === item.id ? 'bg-white/10 border-white/20' : ''
                    }`}
                  >
                    {/* Main Content */}
                    <div className="p-3">
                      <div className="flex items-start gap-3">
                        {/* Favicon */}
                        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center overflow-hidden">
                          {item.favicon ? (
                            <Image
                              src={item.favicon}
                              alt=""
                              width={24}
                              height={24}
                              className="w-6 h-6 object-contain"
                              unoptimized
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                                const parent = target.parentElement;
                                if (parent) {
                                  parent.innerHTML = `
                                    <svg class="w-6 h-6 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path>
                                    </svg>
                                  `;
                                }
                              }}
                            />
                          ) : (
                            <svg className="w-6 h-6 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                            </svg>
                          )}
                        </div>
                        
                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          {/* Title and Time */}
                          <div className="flex items-start justify-between mb-1">
                            <h3 className="text-white font-medium text-sm leading-5 truncate pr-2">
                              {item.title || getDomainFromUrl(item.originalUrl)}
                            </h3>
                            <span className="text-white/50 text-xs whitespace-nowrap">
                              {formatDate(item.createdAt)}
                            </span>
                          </div>
                          
                          {/* Domain */}
                          <p className="text-white/60 text-xs mb-2 truncate">
                            {getDomainFromUrl(item.originalUrl)}
                          </p>
                          
                          {/* Short URL - Clickable to copy */}
                          <div className="flex items-center gap-2">
                            <div 
                              className="flex-1 min-w-0 bg-white/5 rounded-lg px-3 py-2 cursor-pointer hover:bg-white/10 transition-colors duration-200"
                              onClick={() => handleCopyUrl(item.shortUrl)}
                              title="Click to copy"
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-blue-300 text-sm font-mono truncate">
                                  {item.shortUrl.replace(/^https?:\/\//, '')}
                                </span>
                                <svg className="w-4 h-4 text-white/50 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        {/* Action Buttons - Increased sizes */}
                        <div className="flex items-center gap-1 opacity-100 transition-opacity duration-200">
                          {/* Share Button */}
                          <Button
                            onClick={() => toggleExpanded(item.id)}
                            variant="ghost"
                            size="sm"
                            className={`text-purple-400 hover:text-purple-300 hover:bg-purple-500/20 p-2 h-10 w-10 transition-all duration-200 ${
                              expandedItem === item.id ? 'bg-purple-500/20 text-purple-300' : ''
                            }`}
                            title="Share"
                          >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                            </svg>
                          </Button>
                          
                          {/* Delete Button */}
                          <Button
                            onClick={() => handleRemoveItem(item.id)}
                            variant="ghost"
                            size="sm"
                            className="text-red-400 hover:text-red-300 hover:bg-red-500/20 p-2 h-10 w-10 transition-all duration-200"
                            title="Delete"
                          >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Expanded Share Options */}
                    {expandedItem === item.id && (
                      <div className="px-3 pb-3">
                        <div className="pt-2 border-t border-white/10">
                          <p className="text-white/70 text-xs mb-3 font-medium">Share on:</p>
                          <div className="grid grid-cols-6 gap-3">
                            {/* WhatsApp */}
                            <button
                              onClick={() => shareToWhatsApp(item.shortUrl)}
                              className="w-10 h-10 rounded-xl bg-green-500 hover:bg-green-600 flex items-center justify-center transition-all duration-200 hover:scale-110 shadow-lg"
                              title="WhatsApp"
                            >
                              <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.150-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.130-.606.134-.133.298-.347.446-.520.149-.174.198-.298.298-.497.099-.198.050-.371-.025-.520-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.570-.01-.198 0-.520.074-.792.372-.272.297-1.040 1.016-1.040 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.200 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.360.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.570-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.640 0 5.122 1.030 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .160 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.703"/>
                              </svg>
                            </button>

                            {/* Facebook */}
                            <button
                              onClick={() => shareToFacebook(item.shortUrl)}
                              className="w-10 h-10 rounded-xl bg-blue-600 hover:bg-blue-700 flex items-center justify-center transition-all duration-200 hover:scale-110 shadow-lg"
                              title="Facebook"
                            >
                              <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                              </svg>
                            </button>

                            {/* Twitter/X */}
                            <button
                              onClick={() => shareToTwitter(item.shortUrl)}
                              className="w-10 h-10 rounded-xl bg-black hover:bg-gray-800 flex items-center justify-center transition-all duration-200 hover:scale-110 shadow-lg"
                              title="Twitter"
                            >
                              <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                              </svg>
                            </button>

                            {/* LinkedIn */}
                            <button
                              onClick={() => shareToLinkedIn(item.shortUrl)}
                              className="w-10 h-10 rounded-xl bg-blue-700 hover:bg-blue-800 flex items-center justify-center transition-all duration-200 hover:scale-110 shadow-lg"
                              title="LinkedIn"
                            >
                              <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.370-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.920-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                              </svg>
                            </button>

                            {/* Telegram */}
                            <button
                              onClick={() => shareToTelegram(item.shortUrl)}
                              className="w-10 h-10 rounded-xl bg-blue-500 hover:bg-blue-600 flex items-center justify-center transition-all duration-200 hover:scale-110 shadow-lg"
                              title="Telegram"
                            >
                              <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.140.141-.259.259-.374.261l.213-3.053 5.56-5.022c.24-.213-.054-.334-.373-.121l-6.869 4.326-2.96-.924c-.640-.203-.658-.640.136-.954l11.566-4.458c.538-.196 1.006.128.832.941z"/>
                              </svg>
                            </button>

                            {/* Email */}
                            <button
                              onClick={() => shareViaEmail(item.shortUrl)}
                              className="w-10 h-10 rounded-xl bg-gray-600 hover:bg-gray-700 flex items-center justify-center transition-all duration-200 hover:scale-110 shadow-lg"
                              title="Email"
                            >
                              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {/* Footer */}
          {state.items.length > 0 && (
            <div className="p-4 border-t border-white/10">
              <p className="text-white/50 text-xs text-center">
                {state.items.length} link{state.items.length === 1 ? '' : 's'} saved
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Confirm Clear Dialog */}
      {showConfirmClear && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-60 flex items-center justify-center p-4">
          <div className="bg-gray-900/95 backdrop-blur-sm rounded-2xl shadow-2xl p-6 max-w-sm w-full border border-white/10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-15 h-15 rounded-full bg-red-500/10 flex items-center justify-center">
                <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-white">Clear History?</h3>
            </div>
            
            <p className="text-white/70 text-sm mb-6 leading-relaxed">
              This will permanently delete all {state.items.length} shortened link{state.items.length === 1 ? '' : 's'} from your history. This action cannot be undone.
            </p>
            
            <div className="flex gap-3">
              <Button
                onClick={() => setShowConfirmClear(false)}
                variant="outline"
                className="flex-1 bg-white/5 border-white/20 text-white hover:bg-white/10 hover:border-white/30"
              >
                Cancel
              </Button>
              <Button
                onClick={handleClearHistory}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white border-0"
              >
                Clear All
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default HistorySidebar