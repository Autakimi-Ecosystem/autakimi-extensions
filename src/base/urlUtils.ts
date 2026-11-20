/**
 * URL Sanitizer Utility
 * ---------------------
 * Validates and sanitizes URLs extracted from third-party web scrapers.
 * Rejects dangerous protocols (javascript:, data:, vbscript:, file:) and
 * strictly allows only http: and https: schemes.
 */

export function safeUrl(url: string, baseUrl?: string): string {
  if (!url || typeof url !== 'string') return ''
  const trimmed = url.trim()
  if (!trimmed) return ''

  const lower = trimmed.toLowerCase()
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('vbscript:') ||
    lower.startsWith('file:')
  ) {
    return ''
  }

  try {
    let resolved: URL
    if (baseUrl && !trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      resolved = new URL(trimmed, baseUrl)
    } else {
      resolved = new URL(trimmed)
    }

    if (resolved.protocol === 'http:' || resolved.protocol === 'https:') {
      return resolved.toString()
    }
    return ''
  } catch {
    return ''
  }
}
