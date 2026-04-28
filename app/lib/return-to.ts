const INTERNAL_BASE_URL = 'http://socialite.local'

export function normalizeReturnTo(value: string | null | undefined, fallback: string): string {
  if (!value) return fallback
  if (!value.startsWith('/') || value.startsWith('//')) return fallback
  return value
}

export function refererToReturnTo(referer: string | null | undefined): string | null {
  if (!referer) return null

  try {
    const url = new URL(referer)
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return null
  }
}

export function appendSuccessParam(path: string, success: 'created' | 'updated'): string {
  const url = new URL(path, INTERNAL_BASE_URL)
  url.searchParams.set('success', success)
  return `${url.pathname}${url.search}${url.hash}`
}

export function getPathname(path: string): string {
  return new URL(path, INTERNAL_BASE_URL).pathname
}
