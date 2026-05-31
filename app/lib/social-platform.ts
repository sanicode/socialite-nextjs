import type { SocialPlatform } from '@/app/lib/social-oauth'

export const SOCIAL_LINK_PLATFORM_CONFIGS = [
  {
    platform: 'facebook',
    label: 'Facebook',
    categoryPattern: /facebook|fb\.com|fb\b/i,
    rules: {
      hosts: ['facebook.com', 'fb.com', 'fb.watch'],
      placeholder: 'https://facebook.com/...',
      required: true,
    },
  },
  {
    platform: 'instagram',
    label: 'Instagram',
    categoryPattern: /instagram|ig\b/i,
    rules: {
      hosts: ['instagram.com'],
      placeholder: 'https://instagram.com/p/...',
      required: true,
    },
  },
  {
    platform: 'tiktok',
    label: 'TikTok',
    categoryPattern: /tiktok/i,
    rules: {
      hosts: ['tiktok.com'],
      placeholder: 'https://tiktok.com/@username/video/...',
      required: true,
    },
  },
  {
    platform: 'youtube',
    label: 'YouTube',
    categoryPattern: /youtube|youtu\.be/i,
    rules: {
      hosts: ['youtube.com', 'youtu.be'],
      placeholder: 'https://youtube.com/watch?v=...',
      required: true,
    },
  },
  {
    platform: 'threads',
    label: 'Threads',
    categoryPattern: /\bthreads?\b/i,
    rules: {
      hosts: ['threads.com'],
      placeholder: 'https://threads.com/@username/post/...',
      required: true,
    },
  },
] as const

export type SocialLinkPlatform = (typeof SOCIAL_LINK_PLATFORM_CONFIGS)[number]['platform']

export type SocialUrlRules = {
  hosts: string[]
  placeholder?: string | null
  required?: boolean
}

export type SocialLinkCategoryInput =
  | string
  | {
      name: string
      url_rules?: unknown | null
      urlRules?: unknown | null
    }

export type SocialLinkPlatformHint = {
  platform: SocialLinkPlatform | null
  label: string
  placeholder: string
}

export type SocialLinkRuleResolution = {
  platform: SocialLinkPlatform | null
  label: string
  rules: SocialUrlRules | null
}

const OAUTH_SOCIAL_PLATFORMS = new Set<string>(['facebook', 'instagram', 'tiktok', 'youtube'])

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeAllowedHost(value: unknown) {
  if (typeof value !== 'string') return null

  const text = value.trim().toLowerCase()
  if (!text) return null

  try {
    const url = new URL(text.includes('://') ? text : `https://${text}`)
    let hostname = url.hostname.toLowerCase().replace(/\.$/, '')
    if (hostname.startsWith('www.')) hostname = hostname.slice(4)
    if (!hostname || !hostname.includes('.') || hostname.includes('..')) return null
    if (!/^[a-z0-9.-]+$/.test(hostname)) return null
    return hostname
  } catch {
    return null
  }
}

function normalizeHosts(value: unknown) {
  const rawHosts = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/[\s,]+/)
      : []
  return Array.from(new Set(rawHosts.map(normalizeAllowedHost).filter((host): host is string => Boolean(host))))
}

function cloneRules(rules: { hosts: readonly string[]; placeholder?: string | null; required?: boolean }): SocialUrlRules {
  return {
    hosts: [...rules.hosts],
    ...(rules.placeholder ? { placeholder: rules.placeholder } : {}),
    ...(rules.required === undefined ? {} : { required: rules.required }),
  }
}

function getCategoryName(category: SocialLinkCategoryInput) {
  return typeof category === 'string' ? category : category.name
}

function getCategoryRulesInput(category: SocialLinkCategoryInput) {
  return typeof category === 'string' ? null : category.url_rules ?? category.urlRules ?? null
}

export function getSocialLinkPlatformConfig(platform: SocialLinkPlatform | SocialPlatform | null | undefined) {
  if (!platform) return null
  return SOCIAL_LINK_PLATFORM_CONFIGS.find((config) => config.platform === platform) ?? null
}

export function detectSocialLinkPlatformFromCategory(categoryName: string): SocialLinkPlatform | null {
  return SOCIAL_LINK_PLATFORM_CONFIGS.find(({ categoryPattern }) => categoryPattern.test(categoryName))?.platform ?? null
}

export function detectSocialPlatformFromCategory(categoryName: string): SocialPlatform | null {
  const platform = detectSocialLinkPlatformFromCategory(categoryName)
  return platform && OAUTH_SOCIAL_PLATFORMS.has(platform) ? (platform as SocialPlatform) : null
}

export function normalizeSocialUrlRules(value: unknown): SocialUrlRules | null {
  if (!isRecord(value)) return null

  const hosts = normalizeHosts(value.hosts)
  const placeholder = typeof value.placeholder === 'string' ? value.placeholder.trim() : ''
  const required = value.required === false ? false : true

  if (hosts.length === 0 && !placeholder) return null

  return {
    hosts,
    ...(placeholder ? { placeholder } : {}),
    required,
  }
}

export function resolveSocialLinkRulesForCategory(category: SocialLinkCategoryInput): SocialLinkRuleResolution {
  const name = getCategoryName(category)
  const platform = detectSocialLinkPlatformFromCategory(name)
  const config = getSocialLinkPlatformConfig(platform)
  const explicitRules = normalizeSocialUrlRules(getCategoryRulesInput(category))
  const fallbackRules = config ? cloneRules(config.rules) : null

  return {
    platform,
    label: config?.label ?? (name.trim() || 'Media Sosial'),
    rules: explicitRules ?? fallbackRules,
  }
}

export function getSocialLinkPlatformHint(category: SocialLinkCategoryInput): SocialLinkPlatformHint | null {
  const { platform, label, rules } = resolveSocialLinkRulesForCategory(category)
  if (!rules?.placeholder) return null

  return {
    platform,
    label,
    placeholder: rules.placeholder,
  }
}

export function getSocialPlatformLabel(platform: SocialPlatform | SocialLinkPlatform | null) {
  return getSocialLinkPlatformConfig(platform)?.label ?? 'Media Sosial'
}

function isAllowedHostname(hostname: string, allowedHosts: readonly string[]) {
  const normalized = hostname.toLowerCase().replace(/\.$/, '')
  return allowedHosts.some((allowedHost) => normalized === allowedHost || normalized.endsWith(`.${allowedHost}`))
}

export function isAllowedSocialHostname(source: SocialPlatform | SocialLinkPlatform | SocialUrlRules, hostname: string) {
  const hosts = typeof source === 'string'
    ? getSocialLinkPlatformConfig(source)?.rules.hosts
    : source.hosts
  return hosts && hosts.length > 0 ? isAllowedHostname(hostname, hosts) : false
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

export function validateSocialUrlForCategory(value: string, category: SocialLinkCategoryInput): string | null {
  const { label, rules } = resolveSocialLinkRulesForCategory(category)
  if (!rules) return null

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

  if (rules.hosts.length > 0 && !isAllowedSocialHostname(rules, url.hostname)) {
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
