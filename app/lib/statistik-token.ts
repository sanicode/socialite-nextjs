import crypto from 'crypto'
import { getSessionSecret } from '@/app/lib/env'

export const STATISTIK_TOKEN_TTL_SECONDS = 5 * 60

type HeaderReader = {
  get(name: string): string | null
}

type StatistikTokenPayload = {
  scope: 'statistik'
  accessId: string
  fingerprint: string
  iat: number
  exp: number
}

function base64url(input: string | Buffer): string {
  const buf = typeof input === 'string' ? Buffer.from(input) : input
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function base64urlDecode(input: string): Buffer {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/').padEnd(input.length + (4 - input.length % 4) % 4, '=')
  return Buffer.from(padded, 'base64')
}

function getClientIp(headers: HeaderReader) {
  const forwardedFor = headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return headers.get('cf-connecting-ip')
    ?? headers.get('x-real-ip')
    ?? forwardedFor
    ?? 'unknown'
}

export function getStatistikRequestFingerprint(headers: HeaderReader) {
  const userAgent = headers.get('user-agent') ?? 'unknown'
  const raw = `${getClientIp(headers)}|${userAgent}`
  return crypto.createHash('sha256').update(raw).digest('hex')
}

export function signStatistikToken(accessId: string, fingerprint: string) {
  const now = Math.floor(Date.now() / 1000)
  const payload: StatistikTokenPayload = {
    scope: 'statistik',
    accessId,
    fingerprint,
    iat: now,
    exp: now + STATISTIK_TOKEN_TTL_SECONDS,
  }
  const secret = getSessionSecret()
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = base64url(JSON.stringify(payload))
  const sig = base64url(crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest())

  return `${header}.${body}.${sig}`
}

export function verifyStatistikToken(token: string, accessId: string, fingerprint: string) {
  try {
    const [header, body, sig] = token.split('.')
    if (!header || !body || !sig) return false

    const secret = getSessionSecret()
    const expected = base64url(crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest())
    if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return false

    const payload = JSON.parse(base64urlDecode(body).toString()) as Partial<StatistikTokenPayload>
    const now = Math.floor(Date.now() / 1000)

    return payload.scope === 'statistik'
      && payload.accessId === accessId
      && payload.fingerprint === fingerprint
      && typeof payload.exp === 'number'
      && payload.exp >= now
  } catch {
    return false
  }
}
