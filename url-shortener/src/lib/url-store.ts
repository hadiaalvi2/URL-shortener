const codeToUrl = new Map<string, string>()
const urlToCode = new Map<string, string>()

function makeCode(len = 6) {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
  let out = ""
  while (out.length < len) out += chars[Math.floor(Math.random() * chars.length)]
  if (codeToUrl.has(out)) return makeCode(len)
  return out
}

export function saveUrl(longUrl: string): string {

  const normalized = new URL(longUrl).toString()

  if (urlToCode.has(normalized)) return urlToCode.get(normalized)!
  const code = makeCode(6)
  codeToUrl.set(code, normalized)
  urlToCode.set(normalized, code)
  return code
}

export function getUrl(shortCode: string): string | null {
  return codeToUrl.get(shortCode) ?? null
}
