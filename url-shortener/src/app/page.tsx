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
    <div className="min-h-screen flex items-center justify-center p-4 relative">
      <div className="text-center space-y-12 max-w-4xl mx-auto relative z-10">
        
        {/* Hero Section */}
        <div className="space-y-6">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-600 rounded-full mb-6 backdrop-blur-sm bg-white/10">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          </div>
          
          <h1 className="text-6xl md:text-7xl font-bold text-white tracking-tight leading-tight">
            URL <span className="text-blue-300">Shortener</span>
          </h1>
          
          <p className="text-white/90 text-xl md:text-2xl max-w-2xl mx-auto leading-relaxed">
            Transform your long URLs into <span className="font-semibold text-blue-200">short, shareable links</span> with beautiful rich previews for social media
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 py-8">
          {[
            {
              color: "blue",
              gradient: "from-blue-500 to-blue-600",
              icon: (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                />
              ),
              title: "Lightning Fast",
              desc: "Create clean, memorable short URLs in seconds",
              benefit: "Save characters and look professional"
            },
            {
              color: "green",
              gradient: "from-green-500 to-emerald-600",
              icon: (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"
                />
              ),
              title: "Rich Previews",
              desc: "Automatic metadata extraction with thumbnails",
              benefit: "Beautiful link previews on all platforms"
            },
            {
              color: "purple",
              gradient: "from-purple-500 to-pink-600",
              icon: (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                />
              ),
              title: "Social Ready",
              desc: "Perfect for WhatsApp, Facebook, Twitter & more",
              benefit: "Share anywhere with confidence"
            },
          ].map((feature, idx) => (
            <div
              key={idx}
              className="group relative bg-white/10 backdrop-blur-sm p-8 rounded-2xl border border-white/20 hover:shadow-2xl transition-all duration-500 hover:-translate-y-2"
            >
              <div className="absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-10 transition-opacity duration-500 rounded-2xl"
                   style={{background: `linear-gradient(135deg, var(--tw-gradient-stops))`}}></div>
              
              <div className={`w-16 h-16 bg-gradient-to-br ${feature.gradient} rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300`}>
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {feature.icon}
                </svg>
              </div>
              
              <h3 className="font-bold text-xl text-white mb-3">{feature.title}</h3>
              <p className="text-white/80 mb-3 leading-relaxed">{feature.desc}</p>
              <p className="text-sm text-blue-300 font-medium">{feature.benefit}</p>
            </div>
          ))}
        </div>

        {/* CTA Section */}
        <div className="space-y-6">
          <Button
            asChild
            size="lg"
            className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-12 py-8 text-xl font-bold rounded-2xl transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 border-0"
          >
            <Link href="/shortener" className="group">
              Start Shortening URLs
              <svg className="ml-3 w-6 h-6 group-hover:translate-x-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
          </Button>
          
          <p className="text-white/70 text-sm">
            No registration required • Free forever • Instant results
          </p>
        </div>

      </div>
    </div>
  );
}
