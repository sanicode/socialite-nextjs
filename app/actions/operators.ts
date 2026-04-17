'use server'

import { revalidatePath } from 'next/cache'
import { requireManagerOrAdmin } from '@/app/lib/authorization'
import { prisma } from '@/app/lib/prisma'
import { logEvent } from '@/app/lib/logger'

const MODEL_TYPE_TENANT_USER = 'App\\Models\\TenantUser'

export type OperatorRow = {
  tenant_user_id: string
  user_id: string
  name: string
  email: string
  phone_number: string | null
}

export type OperatorSearchResult = {
  id: string
  name: string
  email: string
}

async function getManagerTenantId(userId: string): Promise<bigint> {
  const tu = await prisma.tenant_user.findFirst({
    where: { user_id: BigInt(userId) },
    select: { tenant_id: true },
  })
  if (!tu) throw new Error('Manager tidak terdaftar di tenant manapun.')
  return tu.tenant_id
}

export async function getOperators(params: {
  page?: number
  pageSize?: number
  search?: string
  email?: string
  phone?: string
} = {}): Promise<{ operators: OperatorRow[]; total: number }> {
  const user = await requireManagerOrAdmin()

  const tenantId = await getManagerTenantId(user.id)

  const page     = params.page     ?? 1
  const pageSize = params.pageSize ?? 20
  const offset   = (page - 1) * pageSize

  const conditions: string[] = [
    `tu.tenant_id = $1`,
    `mhr.model_type = 'App\\Models\\TenantUser'`,
    `r.name = 'operator'`,
    `mhr.model_id = tu.id`,
  ]
  const qParams: unknown[] = [tenantId]
  let idx = 2

  if (params.search) {
    conditions.push(`u.name ILIKE $${idx}`)
    qParams.push(`%${params.search}%`)
    idx++
  }
  if (params.email) {
    conditions.push(`u.email ILIKE $${idx}`)
    qParams.push(`%${params.email}%`)
    idx++
  }
  if (params.phone) {
    conditions.push(`u.phone_number ILIKE $${idx}`)
    qParams.push(`%${params.phone}%`)
    idx++
  }

  const where = conditions.join(' AND ')

  const [rows, countResult] = await Promise.all([
    prisma.$queryRawUnsafe<{
      tenant_user_id: bigint
      user_id: bigint
      name: string
      email: string
      phone_number: string | null
    }[]>(
      `SELECT
         tu.id AS tenant_user_id,
         u.id  AS user_id,
         u.name,
         u.email,
         u.phone_number
       FROM tenant_user tu
       INNER JOIN users u ON u.id = tu.user_id
       INNER JOIN model_has_roles mhr ON mhr.model_id = tu.id
       INNER JOIN roles r ON r.id = mhr.role_id
       WHERE ${where}
       ORDER BY u.name ASC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      ...qParams,
      pageSize,
      offset
    ),
    prisma.$queryRawUnsafe<{ count: bigint }[]>(
      `SELECT COUNT(DISTINCT tu.id) AS count
       FROM tenant_user tu
       INNER JOIN users u ON u.id = tu.user_id
       INNER JOIN model_has_roles mhr ON mhr.model_id = tu.id
       INNER JOIN roles r ON r.id = mhr.role_id
       WHERE ${where}`,
      ...qParams
    ),
  ])

  return {
    operators: rows.map((r) => ({
      tenant_user_id: r.tenant_user_id.toString(),
      user_id: r.user_id.toString(),
      name: r.name,
      email: r.email,
      phone_number: r.phone_number,
    })),
    total: Number(countResult[0]?.count ?? 0),
  }
}

export async function searchUsersForOperator(query: string): Promise<OperatorSearchResult[]> {
  const user = await requireManagerOrAdmin()
  if (!query || query.trim().length < 2) return []

  const tenantId = await getManagerTenantId(user.id)

  const rows = await prisma.$queryRawUnsafe<{ id: bigint; name: string; email: string }[]>(
    `SELECT u.id, u.name, u.email
     FROM users u
     WHERE (u.name ILIKE $1 OR u.email ILIKE $1)
       AND u.is_blocked = false
       AND u.id NOT IN (
         SELECT user_id FROM tenant_user WHERE tenant_id = $2
       )
     ORDER BY u.name ASC
     LIMIT 10`,
    `%${query.trim()}%`,
    tenantId
  )

  return rows.map((r) => ({ id: r.id.toString(), name: r.name, email: r.email }))
}

export async function attachOperator(userId: string): Promise<void> {
  const user = await requireManagerOrAdmin()

  const tenantId = await getManagerTenantId(user.id)

  const existing = await prisma.tenant_user.findFirst({
    where: { tenant_id: tenantId, user_id: BigInt(userId) },
  })
  if (existing) throw new Error('User sudah terdaftar di tenant ini.')

  const role = await prisma.roles.findFirst({
    where: { name: 'operator' },
    orderBy: [{ is_tenant_role: 'desc' }, { id: 'asc' }],
  })
  if (!role) throw new Error(`Role 'operator' tidak ditemukan di database.`)

  const tu = await prisma.tenant_user.create({
    data: { tenant_id: tenantId, user_id: BigInt(userId) },
  })

  await prisma.model_has_roles.create({
    data: { role_id: role.id, model_type: MODEL_TYPE_TENANT_USER, model_id: tu.id },
  })

  logEvent('info', 'operator.attached', {
    managerId: user.id,
    tenantId: tenantId.toString(),
    userId,
  })
  revalidatePath('/operators')
}

export async function detachOperator(tenantUserId: string): Promise<void> {
  const user = await requireManagerOrAdmin()

  await prisma.model_has_roles.deleteMany({
    where: { model_type: MODEL_TYPE_TENANT_USER, model_id: BigInt(tenantUserId) },
  })
  await prisma.tenant_user.delete({ where: { id: BigInt(tenantUserId) } })

  logEvent('warn', 'operator.detached', { managerId: user.id, tenantUserId })
  revalidatePath('/operators')
}
