import type { SocialPlatform } from '@/app/lib/social-oauth'

const SOCIAL_PLATFORM_KEYWORDS: Array<{ platform: SocialPlatform; pattern: RegExp }> = [
  { platform: 'facebook', pattern: /facebook|fb\.com|fb\b/i },
  { platform: 'instagram', pattern: /instagram|ig\b/i },
  { platform: 'tiktok', pattern: /tiktok/i },
  { platform: 'youtube', pattern: /youtube|youtu\.be/i },
]

const SOCIAL_PLATFORM_HOSTS: Record<SocialPlatform, string[]> = {
  facebook: ['facebook.com', 'fb.com', 'fb.watch'],
  instagram: ['instagram.com'],
  tiktok: ['tiktok.com'],
  youtube: ['youtube.com', 'youtu.be'],
}

const TRACKING_QUERY_PARAMS = [
  'fbclid',
  'gclid',
  'igshid',
  'mc_cid',
  'mc_eid',
  'si',
  'utm_campaign',
  'utm_content',
  'utm_medium',
  'utm_source',
  'utm_term',
]

const HTTP_URL_PATTERN = /https?:\/\/[^\s<>"'`]+/i
const TRAILING_URL_PUNCTUATION = /[),.;!?]+$/g

export function detectSocialPlatformFromCategory(categoryName: string): SocialPlatform | null {
  return SOCIAL_PLATFORM_KEYWORDS.find(({ pattern }) => pattern.test(categoryName))?.platform ?? null
}

export function getSocialPlatformLabel(platform: SocialPlatform | null) {
  switch (platform) {
    case 'facebook':
      return 'Facebook'
    case 'instagram':
      return 'Instagram'
    case 'tiktok':
      return 'TikTok'
    case 'youtube':
      return 'YouTube'
    default:
      return 'Media Sosial'
  }
}

function isAllowedHostname(hostname: string, allowedHosts: string[]) {
  const normalized = hostname.toLowerCase().replace(/\.$/, '')
  return allowedHosts.some((allowedHost) => normalized === allowedHost || normalized.endsWith(`.${allowedHost}`))
}

export function isAllowedSocialHostname(platform: SocialPlatform, hostname: string) {
  return isAllowedHostname(hostname, SOCIAL_PLATFORM_HOSTS[platform])
}

export function extractFirstHttpUrl(value: string | null | undefined) {
  const text = value?.trim()
  if (!text) return null

  const match = text.match(HTTP_URL_PATTERN)
  return match?.[0].replace(TRAILING_URL_PUNCTUATION, '') ?? null
}

export function isSafeHttpUrl(value: string | null | undefined): value is string {
  if (!value) return false

  try {
    const url = new URL(value.trim())
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

export function validateSocialUrlForCategory(value: string, categoryName: string): string | null {
  const platform = detectSocialPlatformFromCategory(categoryName)
  if (!platform) return null

  const label = getSocialPlatformLabel(platform)
  const urlValue = extractFirstHttpUrl(value)
  if (!urlValue) return `Link harus berupa URL ${label} yang valid.`

  let url: URL

  try {
    url = new URL(urlValue)
  } catch {
    return `Link harus berupa URL ${label} yang valid.`
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return `Link harus berupa URL ${label} yang valid.`
  }

  if (!isAllowedHostname(url.hostname, SOCIAL_PLATFORM_HOSTS[platform])) {
    return `Link harus berupa URL ${label} yang valid.`
  }

  return null
}

export function normalizeSocialUrl(value: string) {
  const urlValue = extractFirstHttpUrl(value) ?? value.trim()

  try {
    const url = new URL(urlValue)
    url.protocol = url.protocol.toLowerCase()
    url.hostname = url.hostname.toLowerCase()
    url.hash = ''

    if (url.pathname !== '/') {
      url.pathname = url.pathname.replace(/\/+$/, '')
    }

    for (const param of TRACKING_QUERY_PARAMS) {
      url.searchParams.delete(param)
    }
    url.searchParams.sort()

    return url.toString()
  } catch {
    return value.trim()
  }
}

export function getEquivalentSocialUrls(value: string) {
  const trimmed = value.trim()
  const normalized = normalizeSocialUrl(trimmed)
  const withoutRootSlash = normalized.endsWith('/') && !normalized.includes('?')
    ? normalized.slice(0, -1)
    : normalized
  const withRootSlash = !withoutRootSlash.endsWith('/') && !withoutRootSlash.includes('?')
    ? `${withoutRootSlash}/`
    : withoutRootSlash

  return Array.from(new Set([trimmed, normalized, withoutRootSlash, withRootSlash].filter(Boolean)))
}
