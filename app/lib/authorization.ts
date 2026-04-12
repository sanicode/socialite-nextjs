import { getSessionUser, type SessionUser } from '@/app/lib/session'

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser()
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

