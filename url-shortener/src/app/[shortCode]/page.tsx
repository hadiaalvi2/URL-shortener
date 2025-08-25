import { redirect } from "next/navigation";
import { getUrl } from "@/lib/url-store";
import type { Metadata } from "next";

interface Props {
  params: { shortCode: string };
}

const baseUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3001";


interface FetchedMetadata {
  title: string;
  description: string;
  image?: string;
  favicon?: string;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { shortCode } = params;
  const urlData = await getUrl(shortCode);
  const metadataBase = new URL(baseUrl);

  if (!urlData) {
    return {
      title: "Invalid or expired link",
      description: "This short link does not exist or has expired.",
      metadataBase,
    };
  }

  let fetchedMetadata: FetchedMetadata | null = null;
  try {
    const metadataApiUrl = new URL("/api/metadata", baseUrl).toString();
    const res = await fetch(metadataApiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: urlData.originalUrl }),
      cache: "no-store",
    });

    if (res.ok) {
      fetchedMetadata = await res.json();
    } else {
      console.error("Failed to fetch metadata from API:", res.status, res.statusText);
    }
  } catch (error) {
    console.error("Error calling metadata API:", error);
  }

  const title = fetchedMetadata?.title || urlData.title || "Shortened Link";
  const description = fetchedMetadata?.description || urlData.description || "Open this link";
  const imageUrl = fetchedMetadata?.image || urlData.image;
  const faviconUrl = fetchedMetadata?.favicon || urlData.favicon;

  const absoluteImageUrl = imageUrl
    ? imageUrl.startsWith("http")
      ? imageUrl
      : new URL(imageUrl, metadataBase).toString()
    : new URL("/og-default.png", metadataBase).toString();

  const absoluteFaviconUrl = faviconUrl
    ? faviconUrl.startsWith("http")
      ? faviconUrl
      : new URL(faviconUrl, metadataBase).toString()
    : new URL("/favicon.ico", metadataBase).toString();

  return {
    metadataBase,
    title,
    description,
    icons: {
      icon: absoluteFaviconUrl,
      shortcut: absoluteFaviconUrl,
      apple: absoluteFaviconUrl,
    },
    openGraph: {
      type: "website",
      title,
      description,
      url: new URL(`/${shortCode}`, metadataBase).toString(), // FIXED HERE
      images: [
        {
          url: absoluteImageUrl,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
      siteName: "URL Shortener",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [absoluteImageUrl],
    },
  };
}

export default async function RedirectPage(props: Props) {
  const { shortCode } = props.params;
  const urlData = await getUrl(shortCode);

  if (urlData) {
    redirect(urlData.originalUrl);
  }

  return (
    <main className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-semibold mb-2">Invalid or expired link</h1>
        <p className="text-muted-foreground">
          The short code “{shortCode}” was not found.
        </p>
      </div>
    </main>
  );
}
