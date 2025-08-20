import { redirect } from "next/navigation"
import { getUrl } from "@/lib/url-store"

export default async function RedirectPage(props: {
  params: Promise<{ shortCode: string }>
}) {
  const { shortCode } = await props.params  

  const originalUrl = getUrl(shortCode)

  if (originalUrl) {
    redirect(originalUrl)
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
  )
}
