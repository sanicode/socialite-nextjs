import crypto from 'crypto'

const JWT_SECRET = process.env.SESSION_SECRET ?? 'fallback-secret-change-me'
const EXPIRES_IN = 60 * 60 * 24 * 7 // 7 days

function base64url(input: string | Buffer): string {
  const buf = typeof input === 'string' ? Buffer.from(input) : input
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function base64urlDecode(input: string): Buffer {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/').padEnd(input.length + (4 - input.length % 4) % 4, '=')
  return Buffer.from(padded, 'base64')
}

export type JwtPayload = {
  sub: string     // userId
  email: string
  roles: string[]
  iat: number
  exp: number
}

export function signJwt(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
  const now = Math.floor(Date.now() / 1000)
  const full: JwtPayload = { ...payload, iat: now, exp: now + EXPIRES_IN }

  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body   = base64url(JSON.stringify(full))
  const sig    = base64url(
    crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest()
  )

  return `${header}.${body}.${sig}`
}

export function verifyJwt(token: string): JwtPayload | null {
  try {
    const [header, body, sig] = token.split('.')
    if (!header || !body || !sig) return null

    const expected = base64url(
      crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest()
    )
    if (expected !== sig) return null

    const payload: JwtPayload = JSON.parse(base64urlDecode(body).toString())
    if (payload.exp < Math.floor(Date.now() / 1000)) return null

    return payload
  } catch {
    return null
  }
}
