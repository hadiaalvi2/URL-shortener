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
  const exampleShortCode = "abc123";
  const exampleBaseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const exampleShortUrl = `${exampleBaseUrl}/${exampleShortCode}`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="text-center space-y-8 max-w-lg mx-auto">
        {/* Main heading */}
        <div className="space-y-4">
          <h1 className="text-5xl font-bold text-gray-900 tracking-tight">
            URL Shortener
          </h1>
          <p className="text-gray-600 text-lg">
            Transform your long URLs into short, shareable links with rich previews
          </p>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-6">
          {[
            {
              color: "blue",
              icon: (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                />
              ),
              title: "Short Links",
              desc: "Create clean, memorable URLs",
            },
            {
              color: "green",
              icon: (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              ),
              title: "Rich Previews",
              desc: "Automatic metadata extraction",
            },
            {
              color: "purple",
              icon: (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                />
              ),
              title: "Easy Sharing",
              desc: "Perfect for social media",
            },
          ].map((feature, idx) => (
            <div
              key={idx}
              className="bg-white/80 backdrop-blur-sm p-4 rounded-lg border border-gray-200/50 hover:shadow-md transition-all duration-300 hover:-translate-y-1"
            >
              <div
                className={`w-12 h-12 bg-${feature.color}-100 rounded-full flex items-center justify-center mx-auto mb-3`}
              >
                <svg
                  className={`w-6 h-6 text-${feature.color}-600`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  {feature.icon}
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">{feature.title}</h3>
              <p className="text-sm text-gray-600">{feature.desc}</p>
            </div>
          ))}
        </div>

        {/* CTA Button */}
        <Button
          asChild
          size="lg"
          className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-6 text-lg font-semibold rounded-xl transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5"
        >
          <Link href="/shortener">
            Get Started
            <svg
              className="ml-2 w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 7l5 5m0 0l-5 5m5-5H6"
              />
            </svg>
          </Link>
        </Button>

        {/* Example preview (dynamic) */}
        <div className="pt-8 border-t border-gray-200/50 mt-8">
          <p className="text-sm text-gray-500 mb-3">Example of shared links:</p>
          <div className="bg-white/80 backdrop-blur-sm p-4 rounded-lg border border-gray-200/50 text-left max-w-md mx-auto hover:shadow-md transition-all duration-300">
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-gray-200 rounded flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs text-gray-500">🌐</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 truncate">
                  Example from your shortener
                </p>
                <p className="text-sm text-gray-600 truncate">
                  Shortened link preview with OG tags
                </p>
                <p className="text-xs text-blue-600 truncate">{exampleShortUrl}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
