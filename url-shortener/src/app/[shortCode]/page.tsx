import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Metadata } from "next";

const baseUrl =
  process.env.NEXT_PUBLIC_BASE_URL || "https://url-shortener-rouge-eta.vercel.app/";


export async function generateMetadata({
  params,
}: {
  params: Promise<{ shortCode: string }>;
}): Promise<Metadata> {
  const { shortCode } = await params;

  try {
    const { data: urlData, error } = await supabase
      .from("urls")
      .select("*")
      .eq("short_code", shortCode)
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
  } catch (err) {
    console.error("Metadata error:", err);
    return {
      title: "URL Shortener",
      description: "Shortened URL service",
    };
  }
}

export default async function RedirectPage({
  params,
}: {
  params: { shortCode: string };
}) {
  const { shortCode } = params;

  try {
    const { data, error } = await supabase
      .from("urls")
      .select("original_url")
      .eq("short_code", shortCode)
      .single();

    if (error) {
      return <ErrorMessage title="Database Error" message={`Error: ${error.message}`} />;
    }

    if (!data || !data.original_url) {
      return <ErrorMessage title="Link Not Found" message={`The short code "${shortCode}" does not exist.`} />;
    }

    // ✅ Perform server-side redirect (SEO friendly)
    redirect(data.original_url);
  } catch (err: any) {
    console.error("Unexpected error:", err);
    return (
      <ErrorMessage
        title="Server Error"
        message={err.message || "An unexpected error occurred."}
      />
    );
  }
}

function ErrorMessage({ title, message }: { title: string; message: string }) {
  return (
    <main className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-semibold mb-2">{title}</h1>
        <p className="text-muted-foreground">{message}</p>
      </div>
    </main>
  );
}
