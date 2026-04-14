'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/app/lib/authorization'
import { prisma } from '@/app/lib/prisma'
import { logEvent } from '@/app/lib/logger'
import type { Prisma } from '@/app/generated/prisma/client'

export type UserRow = {
  id: string
  name: string
  email: string
  is_blocked: boolean
  is_admin: boolean
  last_seen_at: string | null
  active_failed_attempts: number
}

export type GetUsersResult = {
  users: UserRow[]
  total: number
  totalBlocked: number
  totalUnderAttack: number
}

export async function getUsers(params: {
  page?: number
  pageSize?: number
  search?: string
  status?: string   // 'active' | 'blocked' | '' (semua)
  dateFrom?: string // ISO date string YYYY-MM-DD
  dateTo?: string   // ISO date string YYYY-MM-DD
  sortBy?: string   // 'name' | 'email' | 'is_blocked' | 'last_seen_at'
  sortDir?: string  // 'asc' | 'desc'
} = {}): Promise<GetUsersResult> {
  await requireAdmin()

  const page     = params.page     ?? 1
  const pageSize = params.pageSize ?? 20
  const offset   = (page - 1) * pageSize

  const where: Prisma.usersWhereInput = {}
  if (params.search) {
    where.OR = [
      { name:  { contains: params.search, mode: 'insensitive' } },
      { email: { contains: params.search, mode: 'insensitive' } },
    ]
  }
  if (params.status === 'blocked') where.is_blocked = true
  if (params.status === 'active')  where.is_blocked = false
  if (params.dateFrom || params.dateTo) {
    where.last_seen_at = {
      ...(params.dateFrom ? { gte: new Date(params.dateFrom) } : {}),
      ...(params.dateTo   ? { lte: new Date(params.dateTo + 'T23:59:59.999Z') } : {}),
    }
  }

  const dir: Prisma.SortOrder = params.sortDir === 'desc' ? 'desc' : 'asc'
  let orderBy: Prisma.usersOrderByWithRelationInput[]
  switch (params.sortBy) {
    case 'email':
      orderBy = [{ email: dir }]
      break
    case 'is_blocked':
      orderBy = [{ is_blocked: dir }, { name: 'asc' }]
      break
    case 'last_seen_at':
      orderBy = [{ last_seen_at: dir }, { name: 'asc' }]
      break
    default:
      orderBy = [{ name: dir }]
  }

  const [users, total, totalBlocked, counts] = await Promise.all([
    prisma.users.findMany({
      where,
      select: { id: true, name: true, email: true, is_blocked: true, is_admin: true, last_seen_at: true },
      orderBy,
      take: pageSize,
      skip: offset,
    }),
    prisma.users.count({ where }),
    prisma.users.count({ where: { is_blocked: true } }),
    prisma.$queryRaw<{ email: string; count: bigint }[]>`
      SELECT email, COUNT(*)::bigint AS count
      FROM login_attempts
      WHERE attempted_at > NOW() - INTERVAL '1 hour'
        AND email IS NOT NULL
      GROUP BY email
    `,
  ])

  const countMap = new Map(counts.map((r) => [r.email.toLowerCase(), Number(r.count)]))
  const totalUnderAttack = counts.filter((r) => Number(r.count) > 10).length

  return {
    total,
    totalBlocked,
    totalUnderAttack,
    users: users.map((u) => ({
      id: u.id.toString(),
      name: u.name,
      email: u.email,
      is_blocked: u.is_blocked,
      is_admin: u.is_admin,
      last_seen_at: u.last_seen_at?.toISOString() ?? null,
      active_failed_attempts: countMap.get(u.email.toLowerCase()) ?? 0,
    })),
  }
}

export async function toggleUserBlock(userId: string, block: boolean): Promise<void> {
  const admin = await requireAdmin()

  await prisma.users.update({
    where: { id: BigInt(userId) },
    data: { is_blocked: block },
  })

  logEvent('warn', 'user.block_toggled', { adminId: admin.id, userId, block })
  revalidatePath('/settings/users')
}

export async function bulkToggleBlock(userIds: string[], block: boolean): Promise<{ count: number }> {
  const admin = await requireAdmin()

  const result = await prisma.users.updateMany({
    where: { id: { in: userIds.map((id) => BigInt(id)) } },
    data: { is_blocked: block },
  })

  logEvent('warn', 'user.bulk_block_toggled', { adminId: admin.id, count: result.count, block })
  revalidatePath('/settings/users')
  return { count: result.count }
}

export async function bulkResetRateLimit(emails: string[]): Promise<{ count: number }> {
  const admin = await requireAdmin()

  await prisma.$executeRaw`
    DELETE FROM login_attempts
    WHERE email = ANY(${emails}::text[])
  `

  logEvent('warn', 'user.bulk_rate_limit_reset', { adminId: admin.id, count: emails.length, emails })
  revalidatePath('/settings/users')
  return { count: emails.length }
}

export async function resetUserRateLimit(email: string): Promise<void> {
  const admin = await requireAdmin()

  const emailKey   = email.toLowerCase()
  const emailIpKey = `${emailKey}|`

  // Hapus semua tier untuk email ini (Tier 1 prefix, Tier 3 exact)
  await prisma.$executeRaw`
    DELETE FROM login_attempts
    WHERE email = ${email}
  `

  logEvent('warn', 'user.rate_limit_reset', { adminId: admin.id, email, emailKey, emailIpKey })
  revalidatePath('/settings/users')
}
