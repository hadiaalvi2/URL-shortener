import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "URL Shortener | Shorten Links with Rich Previews",
  description: "Transform long URLs into short, shareable links with automatic rich previews.",
  openGraph: {
    title: "URL Shortener",
    description: "Shorten your links and generate rich previews for social sharing.",
    url: process.env.NEXT_PUBLIC_BASE_URL,
    images: ["/og-default.png"],
  },
  twitter: {
    card: "summary_large_image", 
    title: "URL Shortener",
    description: "Shorten your links and generate rich previews for social sharing.",
    images: ["/og-default.png"],
  },
};

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="border-b border-gray-100 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center space-x-2 group">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center group-hover:scale-105 transition-transform">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
              </div>
              <span className="text-xl font-bold text-gray-900">LinkShrink</span>
            </Link>
            <Button asChild className="rounded-full shadow-sm hover:shadow-md transition-shadow">
              <Link href="/shortener">
                Try it now
                <svg className="ml-2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center py-16 md:py-24 space-y-12">
          <div className="space-y-6 max-w-3xl mx-auto">
            <div className="inline-flex items-center rounded-full bg-blue-100 px-4 py-1.5 text-sm font-medium text-blue-700 mb-4 animate-pulse">
              <span className="relative flex h-2 w-2 mr-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600"></span>
              </span>
              No signup required • Free forever
            </div>
            
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-gray-900 tracking-tight">
              Shorten URLs with
              <br />
              <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Rich Previews
              </span>
            </h1>
            
          </div>

          {/* Quick Demo */}
          <div className="max-w-4xl mx-auto">
            <div className="bg-gradient-to-br from-blue-50 to-purple-50 border border-blue-100 rounded-2xl p-6 md:p-8 shadow-sm">
              <div className="space-y-6">
                <div className="text-sm font-medium text-blue-700 uppercase tracking-wide flex items-center justify-center">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  See it in action
                </div>
                
                {/* Before/After Example */}
                <div className="grid md:grid-cols-2 gap-6 md:gap-8 items-center">
                  {/* Before */}
                  <div className="space-y-3">
                    <div className="text-sm font-medium text-gray-700 flex items-center">
                      <span className="bg-red-100 text-red-700 rounded-full w-5 h-5 flex items-center justify-center text-xs mr-2">×</span>
                      Before
                    </div>
                    <div className="bg-white border border-red-200 rounded-xl p-4 shadow-xs">
                      <div className="text-xs md:text-sm text-gray-500 break-all font-mono leading-relaxed">
                        https://very-long-domain-name.com/articles/how-to-build-amazing-web-applications/with-nextjs-and-tailwind
                      </div>
                    </div>
                  </div>


                  {/* After */}
                  <div className="space-y-3">
                    <div className="text-sm font-medium text-gray-700 flex items-center">
                      <span className="bg-green-100 text-green-700 rounded-full w-5 h-5 flex items-center justify-center text-xs mr-2">✓</span>
                      After
                    </div>
                    <div className="bg-white border border-green-200 rounded-xl overflow-hidden shadow-xs hover:shadow-sm transition-shadow">
                      {/* Short URL */}
                      <div className="p-4 border-b border-gray-100 bg-gray-50/50">
                        <div className="text-sm font-mono text-blue-600 flex items-center">
                          <span>linkshrink.app/abc123</span>
                          <button className="ml-2 text-gray-400 hover:text-blue-600">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>


        {/* How it works */}
        <div className="py-16 md:py-24 bg-gradient-to-b from-gray-50 to-white rounded-3xl mb-8">
          <div className="text-center mb-12 md:mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">How it works</h2>
            <p className="text-lg text-gray-600">Simple, fast, and effective URL shortening in three steps</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {[
              {
                step: "1",
                title: "Paste your URL",
                description: "Simply paste any long URL into our shortener",
                icon: (
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                )
              },
              {
                step: "2", 
                title: "Get your short link",
                description: "Receive a clean, shortened URL instantly",
                icon: (
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                )
              },
              {
                step: "3",
                title: "Share anywhere",
                description: "Share with rich previews on all platforms",
                icon: (
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                )
              }
            ].map((step, idx) => (
              <div key={idx} className="text-center group">
                <div className="relative inline-flex flex-col items-center">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 text-white rounded-2xl flex items-center justify-center text-lg font-bold mb-4 group-hover:scale-105 transition-transform shadow-lg">
                    {step.icon}
                  </div>
                  <div className="absolute -top-2 -right-2 w-8 h-8 bg-white rounded-full flex items-center justify-center text-blue-600 font-bold border-2 border-blue-100 shadow-sm">
                    {step.step}
                  </div>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{step.title}</h3>
                <p className="text-gray-600">{step.description}</p>
              </div>
            ))}
          </div>
          
          <div className="text-center mt-12">
            <Button asChild variant="outline" className="rounded-full">
              <Link href="/shortener">
                Get Started Now
                <svg className="ml-2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </Link>
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}