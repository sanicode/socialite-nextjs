import crypto from 'crypto'
import { getSessionSecret } from '@/app/lib/env'

export type SocialPlatform = 'youtube' | 'facebook' | 'instagram' | 'tiktok'

export type SocialProviderPublicConfig = {
  platform: SocialPlatform
  label: string
  configured: boolean
}

type SocialProviderConfig = SocialProviderPublicConfig & {
  authUrl: string
  tokenUrl: string
  clientId?: string
  clientSecret?: string
  scopes: string[]
}

type SocialOAuthState = {
  platform: SocialPlatform
  userId: string
  nonce: string
  exp: number
  providerAccountId?: string
  accountProfileUrl?: string
  accountSourceUrl?: string
}

export type SocialAccountReference = {
  providerAccountId: string
  profileUrl: string | null
  sourceUrl: string
}

function getConfiguredScopes(envName: string, fallback: string[]) {
  const value = process.env[envName]
  if (!value) return fallback
  return value
    .split(/[,\s]+/)
    .map((scope) => scope.trim())
    .filter(Boolean)
}

function getFacebookScopes() {
  const baseScopes = ['public_profile', 'email']
  const pageScopes = ['pages_show_list', 'pages_read_engagement', 'pages_manage_posts']
  const pagePublishingEnabled = process.env.FACEBOOK_ENABLE_PAGE_PUBLISHING === 'true'
  const configuredScopes = getConfiguredScopes(
    'FACEBOOK_SCOPES',
    pagePublishingEnabled ? [...baseScopes, ...pageScopes] : baseScopes
  )

  if (pagePublishingEnabled) return configuredScopes

  const pagePermissionPrefixes = ['pages_', 'ads_', 'business_management']
  return configuredScopes.filter((scope) => !pagePermissionPrefixes.some((prefix) => scope.startsWith(prefix)))
}

function parseUrl(value: string) {
  try {
    return new URL(value)
  } catch {
    return null
  }
}

function isFacebookHost(hostname: string) {
  return /(^|\.)facebook\.com$/i.test(hostname) || /(^|\.)fb\.com$/i.test(hostname)
}

function buildFacebookProfileUrl(accountId: string) {
  return `https://www.facebook.com/profile.php?id=${accountId}`
}

function extractFacebookAccountIdFromUrl(value: string | null | undefined) {
  if (!value) return null
  const url = parseUrl(value)
  if (!url || !isFacebookHost(url.hostname)) return null

  const accountId = url.searchParams.get('id') ?? url.searchParams.get('profile_id')
  if (accountId && /^\d+$/.test(accountId)) return accountId

  return url.pathname
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean)
    .findLast((segment) => /^\d+$/.test(segment)) ?? null
}

export function extractSocialAccountFromUrl(platform: SocialPlatform, value: string): SocialAccountReference | null {
  const url = parseUrl(value.trim())
  if (!url) return null

  if (platform === 'facebook') {
    if (!isFacebookHost(url.hostname)) return null

    const accountId = extractFacebookAccountIdFromUrl(url.toString())
    if (accountId) {
      return {
        providerAccountId: accountId,
        profileUrl: buildFacebookProfileUrl(accountId),
        sourceUrl: url.toString(),
      }
    }
  }

  return null
}

export type SocialProfile = {
  platform: SocialPlatform
  providerAccountId: string
  accessToken?: string | null
  username: string | null
  email: string | null
  phone: string | null
  gender: string | null
  birthday: string | null
  firstName: string | null
  lastName: string | null
  displayName: string | null
  profileUrl: string | null
  avatarUrl: string | null
  metadata: Record<string, unknown>
}

const emptySocialProfileDetails = {
  email: null,
  phone: null,
  gender: null,
  birthday: null,
  firstName: null,
  lastName: null,
} satisfies Pick<SocialProfile, 'email' | 'phone' | 'gender' | 'birthday' | 'firstName' | 'lastName'>

export function isSocialOAuthDebugEnabled() {
  return process.env.SOCIAL_OAUTH_DEBUG === 'true'
}

export function maskSocialOAuthSecret(value: unknown) {
  if (typeof value !== 'string') return value
  if (value.length <= 12) return `${value.slice(0, 2)}***`
  return `${value.slice(0, 6)}...${value.slice(-4)}`
}

export function sanitizeSocialOAuthPayload(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => sanitizeSocialOAuthPayload(item))
  if (!value || typeof value !== 'object') return value

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => {
      if (/(access|refresh|id)_?token|client_secret|secret|code/i.test(key)) {
        return [key, maskSocialOAuthSecret(item)]
      }
      return [key, sanitizeSocialOAuthPayload(item)]
    })
  )
}

export function getSocialProviderConfigs(): SocialProviderConfig[] {
  return [
    {
      platform: 'youtube',
      label: 'YouTube',
      configured: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
      authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      scopes: ['openid', 'profile', 'email', 'https://www.googleapis.com/auth/youtube.readonly'],
    },
    {
      platform: 'facebook',
      label: 'Facebook',
      configured: Boolean(process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET),
      authUrl: 'https://www.facebook.com/v19.0/dialog/oauth',
      tokenUrl: 'https://graph.facebook.com/v19.0/oauth/access_token',
      clientId: process.env.FACEBOOK_CLIENT_ID,
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
      scopes: getFacebookScopes(),
    },
    {
      platform: 'instagram',
      label: 'Instagram',
      configured: Boolean(process.env.INSTAGRAM_CLIENT_ID && process.env.INSTAGRAM_CLIENT_SECRET),
      authUrl: 'https://api.instagram.com/oauth/authorize',
      tokenUrl: 'https://api.instagram.com/oauth/access_token',
      clientId: process.env.INSTAGRAM_CLIENT_ID,
      clientSecret: process.env.INSTAGRAM_CLIENT_SECRET,
      scopes: ['user_profile'],
    },
    {
      platform: 'tiktok',
      label: 'TikTok',
      configured: Boolean(process.env.TIKTOK_CLIENT_KEY && process.env.TIKTOK_CLIENT_SECRET),
      authUrl: 'https://www.tiktok.com/v2/auth/authorize/',
      tokenUrl: 'https://open.tiktokapis.com/v2/oauth/token/',
      clientId: process.env.TIKTOK_CLIENT_KEY,
      clientSecret: process.env.TIKTOK_CLIENT_SECRET,
      scopes: ['user.info.basic'],
    },
  ]
}

export function getSocialProvider(platform: string): SocialProviderConfig | null {
  return getSocialProviderConfigs().find((provider) => provider.platform === platform) ?? null
}

function hmac(value: string) {
  return crypto.createHmac('sha256', getSessionSecret()).update(value).digest('base64url')
}

export function createSocialOAuthState(platform: SocialPlatform, userId: string, accountRef?: SocialAccountReference | null) {
  const payload: SocialOAuthState = {
    platform,
    userId,
    nonce: crypto.randomBytes(16).toString('base64url'),
    exp: Date.now() + 10 * 60 * 1000,
    providerAccountId: accountRef?.providerAccountId,
    accountProfileUrl: accountRef?.profileUrl ?? undefined,
    accountSourceUrl: accountRef?.sourceUrl,
  }
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${encoded}.${hmac(encoded)}`
}

export function verifySocialOAuthState(value: string): SocialOAuthState | null {
  const [encoded, signature] = value.split('.')
  if (!encoded || !signature || hmac(encoded) !== signature) return null

  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SocialOAuthState
    if (payload.exp < Date.now()) return null
    if (!getSocialProvider(payload.platform)) return null
    return payload
  } catch {
    return null
  }
}

export function buildRedirectUri(origin: string, platform: SocialPlatform) {
  return `${origin}/api/social-oauth/${platform}/callback`
}

export function buildAuthorizationUrl(provider: SocialProviderConfig, redirectUri: string, state: string) {
  const url = new URL(provider.authUrl)
  url.searchParams.set('client_id', provider.clientId ?? '')
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', provider.scopes.join(' '))
  url.searchParams.set('state', state)
  url.searchParams.set('access_type', 'offline')
  url.searchParams.set('prompt', 'consent')
  return url
}

export async function exchangeSocialOAuthCode(provider: SocialProviderConfig, code: string, redirectUri: string) {
  const body = new URLSearchParams()
  body.set('client_id', provider.clientId ?? '')
  body.set('client_secret', provider.clientSecret ?? '')
  body.set('code', code)
  body.set('grant_type', 'authorization_code')
  body.set('redirect_uri', redirectUri)

  const response = await fetch(provider.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    cache: 'no-store',
  })
  if (!response.ok) throw new Error('Gagal menukar kode OAuth.')
  return await response.json() as {
    access_token?: string
    refresh_token?: string
    expires_in?: number
    scope?: string
    open_id?: string
  }
}

export async function fetchSocialProfiles(platform: SocialPlatform, accessToken: string): Promise<SocialProfile[]> {
  if (platform === 'youtube') {
    const channelResponse = await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true', {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    })
    if (channelResponse.ok) {
      const payload = await channelResponse.json() as {
        items?: Array<{ id: string; snippet?: { title?: string; customUrl?: string; thumbnails?: { default?: { url?: string } } } }>
      }
      const channel = payload.items?.[0]
      if (channel?.id) {
        const handle = channel.snippet?.customUrl ?? null
        return [{
          platform,
          providerAccountId: channel.id,
          username: handle,
          ...emptySocialProfileDetails,
          displayName: channel.snippet?.title ?? handle,
          profileUrl: handle ? `https://www.youtube.com/${handle}` : `https://www.youtube.com/channel/${channel.id}`,
          avatarUrl: channel.snippet?.thumbnails?.default?.url ?? null,
          metadata: payload,
        }]
      }
    }
  }

  if (platform === 'facebook') {
    type FacebookProfilePayload = {
      id: string
      name?: string
      email?: string
      first_name?: string
      last_name?: string
      gender?: string
      birthday?: string
      link?: string
      picture?: { data?: { url?: string } }
    }
    type FacebookPagesPayload = {
      data?: Array<{
        id: string
        name?: string
        access_token?: string
        link?: string
        category?: string
        tasks?: string[]
        picture?: { data?: { url?: string } }
      }>
    }

    async function fetchFacebookProfile(fields: string) {
      const params = new URLSearchParams({ fields })
      return await fetch(`https://graph.facebook.com/v19.0/me?${params.toString()}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: 'no-store',
      })
    }

    let response = await fetchFacebookProfile('id,name,email,first_name,last_name,gender,birthday,link,picture')
    if (!response.ok) {
      response = await fetchFacebookProfile('id,name,email,link,picture')
    }
    if (!response.ok) throw new Error('Gagal mengambil profil Facebook.')

    const payload = await response.json() as FacebookProfilePayload
    if (isSocialOAuthDebugEnabled()) {
      console.info('[facebook-oauth:raw:/me]', payload)
    }

    async function fetchFacebookPages() {
      const params = new URLSearchParams({
        fields: 'id,name,access_token,link,category,tasks,picture',
        limit: '100',
      })
      return await fetch(`https://graph.facebook.com/v19.0/me/accounts?${params.toString()}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: 'no-store',
      })
    }

    let pagesPayload: FacebookPagesPayload | null = null
    const pagesResponse = await fetchFacebookPages()
    if (pagesResponse.ok) {
      pagesPayload = await pagesResponse.json() as FacebookPagesPayload
      if (isSocialOAuthDebugEnabled()) {
        console.info('[facebook-oauth:raw:/me/accounts]', sanitizeSocialOAuthPayload(pagesPayload))
      }
    } else if (isSocialOAuthDebugEnabled()) {
      console.info('[facebook-oauth:raw:/me/accounts:error]', sanitizeSocialOAuthPayload(await pagesResponse.json().catch(() => null)))
    }

    const profiles: SocialProfile[] = [{
      platform,
      providerAccountId: payload.id,
      accessToken: accessToken,
      username: null,
      email: payload.email ?? null,
      phone: null,
      gender: payload.gender ?? null,
      birthday: payload.birthday ?? null,
      firstName: payload.first_name ?? null,
      lastName: payload.last_name ?? null,
      displayName: payload.name ?? null,
      profileUrl: payload.link ?? `https://facebook.com/${payload.id}`,
      avatarUrl: payload.picture?.data?.url ?? null,
      metadata: {
        account_id_type: 'facebook_me_id',
        account_type: 'facebook_profile',
        facebook_user: payload,
      },
    }]

    for (const page of pagesPayload?.data ?? []) {
      if (!page.id || !page.access_token) continue
      profiles.push({
        platform,
        providerAccountId: page.id,
        accessToken: page.access_token,
        username: null,
        ...emptySocialProfileDetails,
        displayName: page.name ?? null,
        profileUrl: page.link ?? `https://www.facebook.com/${page.id}`,
        avatarUrl: page.picture?.data?.url ?? null,
        metadata: {
          account_id_type: 'facebook_page_id',
          account_type: 'facebook_page',
          facebook_page: page,
          facebook_user_id: payload.id,
        },
      })
    }

    return profiles
  }

  if (platform === 'instagram') {
    const response = await fetch('https://graph.instagram.com/me?fields=id,username,account_type', {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    })
    if (!response.ok) throw new Error('Gagal mengambil profil Instagram.')
    const payload = await response.json() as { id: string; username?: string; account_type?: string }
    return [{
      platform,
      providerAccountId: payload.id,
      username: payload.username ?? null,
      ...emptySocialProfileDetails,
      displayName: payload.username ?? null,
      profileUrl: payload.username ? `https://www.instagram.com/${payload.username}` : null,
      avatarUrl: null,
      metadata: payload,
    }]
  }

  const response = await fetch('https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,avatar_url,display_name,profile_deep_link,username', {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  })
  if (!response.ok) throw new Error('Gagal mengambil profil TikTok.')
  const payload = await response.json() as {
    data?: { user?: { open_id?: string; username?: string; display_name?: string; avatar_url?: string; profile_deep_link?: string } }
  }
  const profile = payload.data?.user
  if (!profile?.open_id) throw new Error('Profil TikTok tidak valid.')
  return [{
    platform,
    providerAccountId: profile.open_id,
    username: profile.username ?? null,
    ...emptySocialProfileDetails,
    displayName: profile.display_name ?? profile.username ?? null,
    profileUrl: profile.profile_deep_link ?? null,
    avatarUrl: profile.avatar_url ?? null,
    metadata: payload,
  }]
}

function tokenKey() {
  return crypto.createHash('sha256').update(getSessionSecret()).digest().subarray(0, 32)
}

export function encryptSocialToken(value: string | undefined) {
  if (!value) return null
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', tokenKey(), iv)
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`
}

export function decryptSocialToken(value: string | null | undefined) {
  if (!value) return null
  const [ivValue, tagValue, encryptedValue] = value.split('.')
  if (!ivValue || !tagValue || !encryptedValue) return null

  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    tokenKey(),
    Buffer.from(ivValue, 'base64url')
  )
  decipher.setAuthTag(Buffer.from(tagValue, 'base64url'))
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, 'base64url')),
    decipher.final(),
  ])
  return decrypted.toString('utf8')
}
