import { cookies } from 'next/headers'
import crypto from 'crypto'
import { prisma } from '@/app/lib/prisma'
import { getUserRoles } from '@/app/lib/permissions'
import { getSessionSecret } from '@/app/lib/env'

const COOKIE_NAME = 'sid'

export type SessionUser = {
  id: string
  name: string
  email: string
  is_admin: boolean
  roles: string[]
}

function sign(value: string): string {
  const hmac = crypto.createHmac('sha256', getSessionSecret())
  hmac.update(value)
  return `${value}.${hmac.digest('base64url')}`
}

function unsign(signed: string): string | null {
  const lastDot = signed.lastIndexOf('.')
  if (lastDot === -1) return null
  const value = signed.slice(0, lastDot)
  const expected = sign(value)
  if (expected !== signed) return null
  return value
}

export async function createSession(userId: string): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, sign(userId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  })
}

export async function getSessionUserId(): Promise<string | null> {
  const cookieStore = await cookies()
  const cookie = cookieStore.get(COOKIE_NAME)
  if (!cookie) return null
  return unsign(cookie.value)
}

export async function deleteSession(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const userId = await getSessionUserId()
  if (!userId) return null

  const user = await prisma.users.findUnique({
    where: { id: BigInt(userId) },
    select: { id: true, name: true, email: true, is_admin: true },
  })
  if (!user) return null

  const roles = await getUserRoles(userId)

  return {
    id: user.id.toString(),
    name: user.name,
    email: user.email,
    is_admin: user.is_admin,
    roles,
  }
}
