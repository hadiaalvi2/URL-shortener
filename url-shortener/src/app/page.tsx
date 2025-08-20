import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="text-center space-y-6">
        <h1 className="text-4xl font-bold text-foreground">URL Shortener</h1>
        <p className="text-muted-foreground text-lg max-w-md">Transform your long URLs into short, shareable links</p>
        <Button asChild size="lg">
          <Link href="/shortener">Get Started</Link>
        </Button>
      </div>
    </div>
  )
}
