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

    if (error || !urlData) {
      return {
        title: "Invalid or expired link",
        description: "This short link does not exist or has expired.",
      };
    }

    return {
      title: urlData.title || "Shortened Link",
      description: urlData.description || "Open this link",
    };
  } catch (error) {
    console.error("Metadata generation error:", error);
    return {
      title: "Error",
      description: "An error occurred",
    };
  }
}

export default async function RedirectPage({ params }: { params: { shortCode: string } }) {
  const { shortCode } = params;

  try {
    console.log('Looking up short code:', shortCode);
    
    const { data, error } = await supabase
      .from('urls')
      .select('original_url')
      .eq('short_code', shortCode)
      .single();

    console.log('Supabase response:', { data, error: error?.message });

    if (error || !data) {
      return (
        <main className="min-h-[60vh] flex items-center justify-center p-6">
          <div className="max-w-md text-center">
            <h1 className="text-2xl font-semibold mb-2">Invalid or expired link</h1>
            <p className="text-muted-foreground">
              The short code &ldquo;{shortCode}&rdquo; was not found.
            </p>
            <p className="text-sm text-muted-foreground mt-4">
              Error: {error?.message || 'No data returned'}
            </p>
          </div>
        </main>
      );
    }

    console.log('Redirecting to:', data.original_url);
    redirect(data.original_url);

  } catch (error: any) {
    console.error("Redirect error:", error);
    return (
      <main className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-semibold mb-2">Server Error</h1>
          <p className="text-muted-foreground">
            An error occurred: {error.message}
          </p>
        </div>
      </main>
    );
  }
}