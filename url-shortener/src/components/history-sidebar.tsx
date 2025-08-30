"use client"

import React, { useState } from 'react'
import { useHistory } from '../contexts/history-context'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import Image from 'next/image'

interface HistorySidebarProps {
  isOpen: boolean
  onToggle: () => void
  isCollapsed?: boolean
  onToggleCollapsed?: () => void
}

export function HistorySidebar({ isOpen, onToggle, isCollapsed = false, onToggleCollapsed }: HistorySidebarProps) {
  const { state, removeItem, clearHistory } = useHistory()
  const { toast } = useToast()
  const [showConfirmClear, setShowConfirmClear] = useState(false)

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

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))
    
    if (diffInHours < 1) {
      return "Just now"
    } else if (diffInHours < 24) {
      return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`
    } else if (diffInHours < 48) {
      return "Yesterday"
    } else {
      return date.toLocaleDateString()
    }
  }

  const truncateText = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text
    return text.substring(0, maxLength) + '...'
  }

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={onToggle}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed top-0 right-0 h-full bg-white/95 backdrop-blur-sm shadow-2xl transform transition-all duration-300 ease-in-out z-50
        ${isOpen ? 'translate-x-0' : 'translate-x-full'}
        ${isCollapsed ? 'w-16' : 'w-80'}
        lg:translate-x-0 lg:static lg:shadow-none lg:bg-white/10 lg:border-l lg:border-white/20
      `}>
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="p-6 border-b border-gray-200 lg:border-white/20 flex items-center justify-between">
            {!isCollapsed ? (
              <>
                <h2 className="text-xl font-bold text-gray-900 lg:text-white flex items-center">
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  History
                </h2>
                
                <div className="flex items-center space-x-2">
                  {/* Clear History Button */}
                  {state.items.length > 0 && (
                    <Button
                      onClick={() => setShowConfirmClear(true)}
                      variant="outline"
                      size="sm"
                      className="text-xs px-2 py-1 h-7 bg-white/20 text-gray-900 lg:text-white border-gray-300 lg:border-white/30 hover:bg-red-50 lg:hover:bg-red-500/20 hover:border-red-500 hover:text-red-600 lg:hover:border-red-400 lg:hover:text-red-300"
                      title="Clear History"
                    >
                      Clear
                    </Button>
                  )}
                  
                  {/* Collapse Button (Desktop only) */}
                  {onToggleCollapsed && (
                    <Button
                      onClick={onToggleCollapsed}
                      variant="outline"
                      size="sm"
                      className="hidden lg:flex p-1 h-7 w-7 bg-white/20 text-gray-900 lg:text-white border-gray-300 lg:border-white/30 hover:bg-gray-50 lg:hover:bg-white/30 hover:border-gray-400 lg:hover:border-white/40"
                      title="Collapse Sidebar"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </Button>
                  )}
                  
                  {/* Close Button (Mobile only) */}
                  <Button
                    onClick={onToggle}
                    variant="outline"
                    size="sm"
                    className="lg:hidden p-1 h-7 w-7 bg-white/20 text-gray-900 border-gray-300 hover:bg-gray-50 hover:border-gray-400"
                    title="Close History"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </Button>
                </div>
              </>
            ) : (
              <div className="w-full flex justify-center">
                <Button
                  onClick={onToggleCollapsed}
                  variant="outline"
                  size="sm"
                  className="p-1 h-8 w-8 bg-white/20 text-gray-900 lg:text-white border-gray-300 lg:border-white/30 hover:bg-gray-50 lg:hover:bg-white/30 hover:border-gray-400 lg:hover:border-white/40"
                  title="Expand History"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </Button>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {isCollapsed ? (
              /* Collapsed View */
              <div className="p-2 space-y-2">
                {state.items.slice(0, 10).map((item) => (
                  <div
                    key={item.id}
                    className="group w-12 h-12 bg-white lg:bg-white/10 rounded-lg border border-gray-200 lg:border-white/20 hover:shadow-md hover:border-blue-300 lg:hover:border-blue-400/50 transition-all duration-200 flex items-center justify-center cursor-pointer"
                    onClick={() => handleCopyUrl(item.shortUrl)}
                    title={`${item.title || new URL(item.originalUrl).hostname}\n${item.shortUrl}`}
                  >
                    {item.favicon ? (
                      <div className="w-6 h-6 rounded overflow-hidden bg-gray-100">
                        <Image
                          src={item.favicon}
                          alt=""
                          width={24}
                          height={24}
                          className="w-full h-full object-contain"
                          unoptimized
                          onError={(e) => {
                            e.currentTarget.style.display = 'none'
                          }}
                        />
                      </div>
                    ) : (
                      <svg className="w-6 h-6 text-gray-400 lg:text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                      </svg>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              /* Expanded View */
              state.items.length === 0 ? (
                <div className="p-6 text-center">
                  <div className="w-16 h-16 bg-gray-100 lg:bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-gray-400 lg:text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 lg:text-white mb-2">No links yet</h3>
                  <p className="text-gray-600 lg:text-white/70 text-sm">
                    Your shortened links will appear here
                  </p>
                </div>
              ) : (
                <div className="p-4 space-y-3">
                  {state.items.map((item) => (
                    <div
                      key={item.id}
                      className="group bg-white lg:bg-white/10 rounded-lg p-4 border border-gray-200 lg:border-white/20 hover:shadow-md hover:border-blue-300 lg:hover:border-blue-400/50 transition-all duration-200"
                    >
                      {/* Item Header */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center min-w-0 flex-1">
                          {item.favicon && (
                            <div className="w-5 h-5 rounded overflow-hidden mr-2 flex-shrink-0 bg-gray-100">
                              <Image
                                src={item.favicon}
                                alt=""
                                width={20}
                                height={20}
                                className="w-full h-full object-contain"
                                unoptimized
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none'
                                }}
                              />
                            </div>
                          )}
                          <h3 className="font-medium text-gray-900 lg:text-white text-sm truncate">
                            {item.title || new URL(item.originalUrl).hostname}
                          </h3>
                        </div>
                        
                        <Button
                          onClick={() => handleRemoveItem(item.id)}
                          variant="outline"
                          size="sm"
                          className="opacity-0 group-hover:opacity-100 p-1 h-6 w-6 bg-white/20 text-gray-900 lg:text-white/60 border-gray-300 lg:border-white/30 hover:bg-red-50 lg:hover:bg-red-500/20 hover:border-red-500 hover:text-red-600 lg:hover:border-red-400 lg:hover:text-red-300 transition-all duration-200"
                          title="Remove from history"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </Button>
                      </div>

                      {/* Original URL */}
                      <p className="text-xs text-gray-600 lg:text-white/70 mb-2 break-all">
                        {truncateText(item.originalUrl, 60)}
                      </p>

                      {/* Description */}
                      {item.description && (
                        <p className="text-xs text-gray-500 lg:text-white/60 mb-3 line-clamp-2">
                          {item.description}
                        </p>
                      )}

                      {/* Short URL and Actions */}
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0 mr-3">
                          <a
                            href={item.shortUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 lg:text-blue-300 hover:text-blue-800 lg:hover:text-blue-200 text-sm font-medium truncate block hover:underline"
                          >
                            {item.shortUrl.replace(/^https?:\/\//, '')}
                          </a>
                          <p className="text-xs text-gray-500 lg:text-white/50 mt-1">
                            {formatDate(item.createdAt)}
                          </p>
                        </div>
                        
                        <Button
                          onClick={() => handleCopyUrl(item.shortUrl)}
                          variant="outline"
                          size="sm"
                          className="px-3 py-1 h-7 text-xs bg-white/20 text-gray-900 lg:text-white/70 border-gray-300 lg:border-white/30 hover:bg-blue-50 lg:hover:bg-blue-500/20 hover:border-blue-500 hover:text-blue-600 lg:hover:border-blue-400 lg:hover:text-blue-300"
                          title="Copy link"
                        >
                          Copy
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        </div>
      </div>

      {/* Confirm Clear Dialog */}
      {showConfirmClear && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-60 flex items-center justify-center p-4">
          <div className="bg-white lg:bg-white/95 rounded-lg shadow-xl p-6 max-w-sm w-full backdrop-blur-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Clear History?</h3>
            <p className="text-gray-600 text-sm mb-6">
              This will permanently delete all your shortened links from history. This action cannot be undone.
            </p>
            <div className="flex space-x-3">
              <Button
                onClick={() => setShowConfirmClear(false)}
                variant="outline"
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleClearHistory}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              >
                Clear
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default HistorySidebar