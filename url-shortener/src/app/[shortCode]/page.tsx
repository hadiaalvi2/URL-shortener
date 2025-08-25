import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Metadata } from "next";

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://url-shortener-rouge-eta.vercel.app";

export async function generateMetadata({ params }: { params: { shortCode: string } }): Promise<Metadata> {
  const { shortCode } = params;
  
  try {
    const { data: urlData, error } = await supabase
      .from('urls')
      .select('*')
      .eq('short_code', shortCode)
      .single();

    const metadataBase = new URL(baseUrl);

    if (error || !urlData) {
      return {
        title: "Invalid or expired link",
        description: "This short link does not exist or has expired.",
        metadataBase,
      };
    }

    return {
      metadataBase,
      title: urlData.title || "Shortened Link",
      description: urlData.description || "Open this link",
      openGraph: {
        title: urlData.title || "Shortened Link",
        description: urlData.description || "Open this link",
        url: new URL(`/${shortCode}`, baseUrl).toString(),
        siteName: "URL Shortener",
      },
      twitter: {
        card: "summary",
        title: urlData.title || "Shortened Link",
        description: urlData.description || "Open this link",
      },
    };
  } catch (error) {
    console.error("Metadata error:", error);
    return {
      title: "URL Shortener",
      description: "Shortened URL service",
    };
  }
}

export default async function RedirectPage({ params }: { params: { shortCode: string } }) {
  const { shortCode } = params;

  try {
    console.log('Attempting to redirect for short code:', shortCode);
    
    const { data, error } = await supabase
      .from('urls')
      .select('original_url')
      .eq('short_code', shortCode)
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return (
        <main className="min-h-[60vh] flex items-center justify-center p-6">
          <div className="max-w-md text-center">
            <h1 className="text-2xl font-semibold mb-2">Database Error</h1>
            <p className="text-muted-foreground">
              Error: {error.message}
            </p>
          </div>
        </main>
      );
    }

    if (!data) {
      return (
        <main className="min-h-[60vh] flex items-center justify-center p-6">
          <div className="max-w-md text-center">
            <h1 className="text-2xl font-semibold mb-2">Link Not Found</h1>
            <p className="text-muted-foreground">
              The short code "{shortCode}" does not exist.
            </p>
          </div>
        </main>
      );
    }

    console.log('Redirecting to:', data.original_url);
    redirect(data.original_url);

  } catch (error: any) {
    console.error("Unexpected error:", error);
    return (
      <main className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-semibold mb-2">Server Error</h1>
          <p className="text-muted-foreground">
            {error.message}
          </p>
        </div>
      </main>
    );
  }
}