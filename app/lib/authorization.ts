import { getSessionUser, type SessionUser } from '@/app/lib/session'
import { getRequestSecurityDecision } from '@/app/lib/request-security'
import { headers } from 'next/headers'
import { verifyJwt } from '@/app/lib/jwt'
import { prisma } from '@/app/lib/prisma'
import { getUserRoles } from '@/app/lib/permissions'

async function getBearerSessionUser(): Promise<SessionUser | null> {
  const headerStore = await headers()
  const auth = headerStore.get('Authorization')
  if (!auth?.startsWith('Bearer ')) return null
  const payload = verifyJwt(auth.slice(7))
  if (!payload) return null

  const user = await prisma.users.findUnique({
    where: { id: BigInt(payload.sub) },
    select: { id: true, name: true, email: true, is_admin: true, is_blocked: true },
  })
  if (!user || user.is_blocked) return null

  const roles = await getUserRoles(payload.sub)
  return {
    id: user.id.toString(),
    name: user.name,
    email: user.email,
    is_admin: user.is_admin,
    roles,
  }
}

export async function requireUser(): Promise<SessionUser> {
  const decision = await getRequestSecurityDecision()
  if (!decision.allowed) {
    throw new Error(decision.message ?? 'Access denied')
  }

  const user = (await getSessionUser()) ?? (await getBearerSessionUser())
  if (!user) {
    throw new Error('Unauthorized')
  }
  return user
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser()
  if (!user.roles.includes('admin')) {
    throw new Error('Forbidden')
  }
  return user
}

export async function requireManagerOrAdmin(): Promise<SessionUser> {
  const user = await requireUser()
  if (!user.roles.includes('admin') && !user.roles.includes('manager')) {
    throw new Error('Forbidden')
  }
  return user
}

export function assertAdmin(user: SessionUser): SessionUser {
  if (!user.roles.includes('admin')) {
    throw new Error('Forbidden')
  }
  return user
}

export function assertNotManagerOnly(user: SessionUser): SessionUser {
  const isAdmin = user.roles.includes('admin')
  const isManager = user.roles.includes('manager')
  if (isManager && !isAdmin) {
    throw new Error('Forbidden')
  }
  return user
}
