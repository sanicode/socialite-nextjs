import { verifyJwt, type JwtPayload } from './jwt'
import { getSecuritySettings } from './request-security'

export function getBearerToken(request: Request): string | null {
  const auth = request.headers.get('Authorization')
  if (!auth?.startsWith('Bearer ')) return null
  return auth.slice(7)
}

export function requireJwt(request: Request): JwtPayload {
  const token = getBearerToken(request)
  if (!token) throw new ApiError(401, 'Token tidak ditemukan')
  const payload = verifyJwt(token)
  if (!payload) throw new ApiError(401, 'Token tidak valid atau sudah kadaluarsa')
  return payload
}

export function requireJwtRole(request: Request, ...roles: string[]): JwtPayload {
  const payload = requireJwt(request)
  if (!roles.some(r => payload.roles.includes(r))) {
    throw new ApiError(403, 'Akses ditolak')
  }
  return payload
}

export async function requireApiEnabled(): Promise<void> {
  const settings = await getSecuritySettings()
  if (!settings.apiEnabled) {
    throw new ApiError(503, 'Forbidden')
  }
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

export function apiError(error: unknown): Response {
  if (error instanceof ApiError) {
    return Response.json({ error: error.message }, { status: error.status })
  }
  console.error(error)
  return Response.json({ error: 'Internal server error' }, { status: 500 })
}
