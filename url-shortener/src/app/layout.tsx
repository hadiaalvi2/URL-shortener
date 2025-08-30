import type React from "react"
import type { Metadata } from "next"
import "./globals.css"
import { ToastProvider } from "@/components/toast-provider"
import { VideoBackground } from "@/components/video-background"

export const metadata: Metadata = {
  title: 'URL Shortener',
  description: 'Shorten your links and share easily!',
  openGraph: {
    title: 'URL Shortener',
    description: 'Shorten and preview links with metadata',
    images: ['/og-default.png'],
    url: process.env.NEXT_PUBLIC_BASE_URL,
    siteName: 'ShortLink',
  },
};
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">  
      <body className="font-sans antialiased">
        <VideoBackground />
        {children}
        <ToastProvider />
      </body>
    </html>
  )
}
