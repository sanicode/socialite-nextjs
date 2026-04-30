import { verifyJwt, type JwtPayload } from './jwt'
import { getSecuritySettings } from './request-security'
import { prisma } from '@/app/lib/prisma'
import { getUserRoles } from '@/app/lib/permissions'

export function getBearerToken(request: Request): string | null {
  const auth = request.headers.get('Authorization')
  if (!auth?.startsWith('Bearer ')) return null
  return auth.slice(7)
}

export async function requireJwt(request: Request): Promise<JwtPayload> {
  const token = getBearerToken(request)
  if (!token) throw new ApiError(401, 'Token tidak ditemukan')
  const payload = verifyJwt(token)
  if (!payload) throw new ApiError(401, 'Token tidak valid atau sudah kadaluarsa')

  const user = await prisma.users.findUnique({
    where: { id: BigInt(payload.sub) },
    select: { id: true, email: true, is_blocked: true },
  })
  if (!user || user.is_blocked) throw new ApiError(401, 'Token tidak valid atau sudah kadaluarsa')

  const roles = await getUserRoles(payload.sub)
  return {
    ...payload,
    email: user.email,
    roles,
  }
}

export async function requireJwtRole(request: Request, ...roles: string[]): Promise<JwtPayload> {
  const payload = await requireJwt(request)
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
