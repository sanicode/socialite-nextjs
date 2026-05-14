import {
  detectSocialPlatformFromCategory,
  extractFirstHttpUrl,
  getSocialPlatformLabel,
  isAllowedSocialHostname,
} from '@/app/lib/social-platform'
import type { SocialPlatform } from '@/app/lib/social-oauth'
import { getOptionalEnv } from '@/app/lib/env'

const MAX_REDIRECTS = 3
const FETCH_TIMEOUT_MS = 4000
const MAX_HTML_BYTES = 200_000
const MAX_DESCRIPTION_LENGTH = 1500
const METADATA_USER_AGENT = 'Mozilla/5.0 (compatible; SocialiteMetadataBot/1.0)'

type OEmbedResponse = {
  title?: unknown
  author_name?: unknown
  author_unique_id?: unknown
  author_url?: unknown
  provider_url?: unknown
  provider_name?: unknown
  type?: unknown
  thumbnail_url?: unknown
}

export type SocialLinkMetadata = {
  description: string | null
  thumbnailUrl: string | null
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
}

function cleanMetadataValue(value: string | null) {
  if (!value) return null
  const cleaned = decodeHtmlEntities(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return cleaned || null
}

function cleanUnknownMetadataValue(value: unknown) {
  return typeof value === 'string' ? cleanMetadataValue(value) : null
}

function normalizeHandle(value: string | null) {
  if (!value) return null
  const cleaned = value.trim()
  if (!cleaned) return null
  return cleaned.startsWith('@') ? cleaned : `@${cleaned}`
}

function getHandleFromUrl(value: string | null) {
  const urlValue = resolveMetadataUrl(value)
  if (!urlValue) return null

  try {
    const url = new URL(urlValue)
    const firstSegment = url.pathname.split('/').filter(Boolean)[0]
    if (!firstSegment) return null
    return firstSegment.startsWith('@') ? normalizeHandle(firstSegment) : null
  } catch {
    return null
  }
}

function getInstagramHandleFromUrl(value: string | null) {
  const urlValue = resolveMetadataUrl(value)
  if (!urlValue) return null

  try {
    const url = new URL(urlValue)
    const firstSegment = url.pathname.split('/').filter(Boolean)[0]
    if (!firstSegment) return null

    const reservedSegments = new Set([
      'accounts',
      'direct',
      'explore',
      'p',
      'reel',
      'reels',
      'stories',
      'tv',
    ])
    return reservedSegments.has(firstSegment.toLowerCase()) ? null : normalizeHandle(firstSegment)
  } catch {
    return null
  }
}

function trimCaptionQuotes(value: string | null) {
  if (!value) return null
  const trimmed = value.trim()
  return trimmed
    .replace(/^["“”]+/, '')
    .replace(/["“”]+\.?$/, '')
    .trim() || null
}

function extractInstagramTextParts(input: {
  title: string | null
  description: string | null
  canonicalUrl: string | null
}) {
  const titleMatch = input.title?.match(/^(.+?)\s+on\s+Instagram:\s*([\s\S]+)$/i)
  const descriptionMatch = input.description?.match(/-\s*([^@\s][^ ]*)\s+on\s+[A-Za-z]+\s+\d{1,2},\s+\d{4}:\s*([\s\S]+)$/)
  const authorName = titleMatch?.[1]?.trim() || descriptionMatch?.[1]?.trim() || null
  const authorHandle = getInstagramHandleFromUrl(input.canonicalUrl) ?? normalizeHandle(authorName)
  const caption = trimCaptionQuotes(titleMatch?.[2] ?? descriptionMatch?.[2] ?? null)

  return { authorName, authorHandle, caption }
}

function isGenericFacebookTitle(value: string | null) {
  if (!value) return true
  return /^(facebook|log in to facebook|masuk ke facebook)$/i.test(value.trim())
}

function formatAccount(authorName: string | null, authorHandle: string | null) {
  if (authorName && authorHandle && !authorName.toLowerCase().includes(authorHandle.slice(1).toLowerCase())) {
    return `${authorName} (${authorHandle})`
  }
  return authorName ?? authorHandle
}

function formatDetailedDescription(input: {
  title?: string | null
  summary?: string | null
  authorName?: string | null
  authorHandle?: string | null
  platformName?: string | null
  contentType?: string | null
}) {
  const account = formatAccount(input.authorName ?? null, input.authorHandle ?? null)
  const contentType = input.contentType
    ? input.contentType.charAt(0).toUpperCase() + input.contentType.slice(1)
    : null
  const rows = [
    account ? `Akun: ${account}` : null,
    input.platformName ? `Platform: ${input.platformName}` : null,
    contentType ? `Tipe: ${contentType}` : null,
    input.title ? `Judul/Caption: ${input.title}` : null,
    input.summary && input.summary !== input.title ? `Deskripsi: ${input.summary}` : null,
  ].filter((row): row is string => Boolean(row))

  return rows.length > 0 ? rows.join('\n').slice(0, MAX_DESCRIPTION_LENGTH) : null
}

function getTagAttributes(tag: string) {
  const attrs = new Map<string, string>()
  for (const match of tag.matchAll(/([a-zA-Z_:.-]+)\s*=\s*("([^"]*)"|'([^']*)')/g)) {
    attrs.set(match[1].toLowerCase(), match[3] ?? match[4] ?? '')
  }
  return attrs
}

function getMetaContent(html: string, names: string[]) {
  const wanted = new Set(names.map((name) => name.toLowerCase()))
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attrs = getTagAttributes(match[0])
    const key =
      attrs.get('property')?.toLowerCase() ??
      attrs.get('name')?.toLowerCase() ??
      attrs.get('itemprop')?.toLowerCase()
    if (key && wanted.has(key)) return cleanMetadataValue(attrs.get('content') ?? null)
  }
  return null
}

function resolveMetadataUrl(value: string | null, baseUrl?: URL) {
  if (!value) return null

  try {
    const url = baseUrl ? new URL(value, baseUrl) : new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}

function getTitle(html: string) {
  const match = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)
  return cleanMetadataValue(match?.[1] ?? null)
}

function extractHtmlMetadata(html: string, baseUrl: URL, platform: SocialPlatform): SocialLinkMetadata {
  let title = getMetaContent(html, ['og:title', 'twitter:title']) ?? getTitle(html)
  const description = getMetaContent(html, ['og:description', 'twitter:description', 'description'])
  const imageUrl = resolveMetadataUrl(getMetaContent(html, ['og:image', 'twitter:image', 'twitter:image:src']), baseUrl)
  const canonicalUrl = resolveMetadataUrl(getMetaContent(html, ['og:url', 'twitter:url']), baseUrl)
  let authorName = getMetaContent(html, ['author', 'article:author', 'profile:username'])
  let authorHandle =
    normalizeHandle(getMetaContent(html, ['twitter:creator', 'twitter:site'])) ??
    getHandleFromUrl(getMetaContent(html, ['article:author'])) ??
    getHandleFromUrl(canonicalUrl) ??
    getHandleFromUrl(baseUrl.toString())
  const platformName = getMetaContent(html, ['og:site_name', 'application-name']) ?? getSocialPlatformLabel(platform)
  const contentType = getMetaContent(html, ['og:type'])

  if (platform === 'instagram') {
    const instagramParts = extractInstagramTextParts({
      title,
      description,
      canonicalUrl: canonicalUrl ?? baseUrl.toString(),
    })
    authorName ??= instagramParts.authorName
    authorHandle ??= instagramParts.authorHandle
    title = instagramParts.caption ?? title
  }

  if (platform === 'facebook') {
    if (authorHandle?.toLowerCase() === '@facebookapp') {
      authorHandle = null
    }

    if (description && !isGenericFacebookTitle(title)) {
      authorName ??= title
      title = description
    }
  }

  return {
    description: formatDetailedDescription({
      title,
      summary: description,
      authorName,
      authorHandle,
      platformName,
      contentType,
    }),
    thumbnailUrl: imageUrl,
  }
}

async function readHtml(response: Response) {
  const reader = response.body?.getReader()
  if (!reader) return ''

  const chunks: Uint8Array[] = []
  let received = 0
  while (received < MAX_HTML_BYTES) {
    const { done, value } = await reader.read()
    if (done || !value) break
    received += value.byteLength
    chunks.push(value.slice(0, Math.max(0, MAX_HTML_BYTES - (received - value.byteLength))))
  }

  const htmlBytes = new Uint8Array(chunks.reduce((total, chunk) => total + chunk.byteLength, 0))
  let offset = 0
  for (const chunk of chunks) {
    htmlBytes.set(chunk, offset)
    offset += chunk.byteLength
  }

  return new TextDecoder().decode(htmlBytes)
}

function isAllowedUrl(url: URL, platform: SocialPlatform) {
  return (
    (url.protocol === 'http:' || url.protocol === 'https:') &&
    isAllowedSocialHostname(platform, url.hostname)
  )
}

function formatOEmbedMetadata(data: OEmbedResponse | null): SocialLinkMetadata | null {
  if (!data) return null

  const title = cleanUnknownMetadataValue(data.title)
  const author = cleanUnknownMetadataValue(data.author_name)
  const authorUrl = cleanUnknownMetadataValue(data.author_url)
  const authorHandle =
    normalizeHandle(cleanUnknownMetadataValue(data.author_unique_id)) ??
    getHandleFromUrl(authorUrl)
  const provider = cleanUnknownMetadataValue(data.provider_name)
  const contentType = cleanUnknownMetadataValue(data.type)
  const thumbnailUrl = cleanUnknownMetadataValue(data.thumbnail_url)

  const safeThumbnailUrl = resolveMetadataUrl(thumbnailUrl)
  const description = formatDetailedDescription({
    title,
    authorName: author,
    authorHandle,
    platformName: provider,
    contentType,
  })
  if (!description && !safeThumbnailUrl) return null

  return {
    description,
    thumbnailUrl: safeThumbnailUrl,
  }
}

async function fetchJsonWithTimeout<T>(url: URL) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      cache: 'no-store',
      redirect: 'error',
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': METADATA_USER_AGENT,
      },
    })

    const contentType = response.headers.get('content-type')?.toLowerCase() ?? ''
    if (!response.ok || (contentType && !contentType.includes('json'))) return null

    return (await response.json()) as T
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

async function fetchTikTokOEmbedDescription(url: URL) {
  const endpoint = new URL('https://www.tiktok.com/oembed')
  endpoint.searchParams.set('url', url.toString())

  return formatOEmbedMetadata(await fetchJsonWithTimeout<OEmbedResponse>(endpoint))
}

async function fetchYouTubeOEmbedDescription(url: URL) {
  const endpoint = new URL('https://www.youtube.com/oembed')
  endpoint.searchParams.set('format', 'json')
  endpoint.searchParams.set('url', url.toString())

  return formatOEmbedMetadata(await fetchJsonWithTimeout<OEmbedResponse>(endpoint))
}

function getMetaOEmbedAccessToken() {
  return (
    getOptionalEnv('META_OEMBED_ACCESS_TOKEN') ??
    getOptionalEnv('FACEBOOK_OEMBED_ACCESS_TOKEN') ??
    getOptionalEnv('FACEBOOK_ACCESS_TOKEN')
  )
}

function getFacebookGraphVersion() {
  const version = getOptionalEnv('FACEBOOK_GRAPH_VERSION') ?? 'v19.0'
  return /^v\d+\.\d+$/.test(version) ? version : 'v19.0'
}

async function fetchMetaOEmbedDescription(platform: Extract<SocialPlatform, 'facebook' | 'instagram'>, url: URL) {
  const accessToken = getMetaOEmbedAccessToken()
  if (!accessToken) return null

  const graphVersion = getFacebookGraphVersion()
  const endpointNames = platform === 'instagram'
    ? ['instagram_oembed']
    : ['oembed_post', 'oembed_video', 'oembed_page']

  for (const endpointName of endpointNames) {
    const endpoint = new URL(`https://graph.facebook.com/${graphVersion}/${endpointName}`)
    endpoint.searchParams.set('url', url.toString())
    endpoint.searchParams.set('access_token', accessToken)

    const metadata = formatOEmbedMetadata(await fetchJsonWithTimeout<OEmbedResponse>(endpoint))
    if (metadata) return metadata
  }

  return null
}

async function fetchProviderMetadata(platform: SocialPlatform, url: URL) {
  switch (platform) {
    case 'tiktok':
      return fetchTikTokOEmbedDescription(url)
    case 'youtube':
      return fetchYouTubeOEmbedDescription(url)
    case 'facebook':
    case 'instagram':
      return fetchMetaOEmbedDescription(platform, url)
    default:
      return null
  }
}

async function fetchHtmlWithCheckedRedirects(startUrl: URL, platform: SocialPlatform) {
  let currentUrl = startUrl

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount++) {
    if (!isAllowedUrl(currentUrl, platform)) return null

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
    try {
      const response = await fetch(currentUrl, {
        cache: 'no-store',
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          Accept: 'text/html,application/xhtml+xml',
          'User-Agent': METADATA_USER_AGENT,
        },
      })

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location')
        if (!location) return null
        currentUrl = new URL(location, currentUrl)
        continue
      }

      const contentType = response.headers.get('content-type') ?? ''
      if (!response.ok || !contentType.toLowerCase().includes('text/html')) return null
      return { html: await readHtml(response), url: currentUrl }
    } catch {
      return null
    } finally {
      clearTimeout(timeout)
    }
  }

  return null
}

export async function getSocialLinkMetadata(value: string, categoryName: string): Promise<SocialLinkMetadata | null> {
  const urlValue = extractFirstHttpUrl(value)
  if (!urlValue) return null

  const platform = detectSocialPlatformFromCategory(categoryName)
  if (!platform) return null

  try {
    const url = new URL(urlValue)
    if (!isAllowedUrl(url, platform)) return null

    const providerMetadata = await fetchProviderMetadata(platform, url)
    if (providerMetadata) return providerMetadata

    const htmlResult = await fetchHtmlWithCheckedRedirects(url, platform)
    return htmlResult ? extractHtmlMetadata(htmlResult.html, htmlResult.url, platform) : null
  } catch {
    return null
  }
}

export async function getSocialLinkMetadataDescription(value: string, categoryName: string) {
  const metadata = await getSocialLinkMetadata(value, categoryName)
  return metadata?.description ?? null
}
