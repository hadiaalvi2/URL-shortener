import type React from "react"
import type { Metadata } from "next"
import "./globals.css"
import { ToastProvider } from "@/components/toast-provider"

export const metadata: Metadata = {
  title: "URL Shortener",
  description: "Transform your long URLs into short, shareable links",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        {children}

        <ToastProvider />
      </body>
    </html>
  )
}
