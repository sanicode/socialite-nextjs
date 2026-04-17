'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/app/lib/authorization'
import { prisma } from '@/app/lib/prisma'
import { logEvent } from '@/app/lib/logger'

// Used when creating/deleting role assignments via Prisma (not inline SQL)
const MODEL_TYPE_TENANT_USER = 'App\\Models\\TenantUser'

export type TenantRow = {
  id: string
  name: string
  domain: string | null
  city: string | null        // city name from reg_cities
  manager_count: number
  operator_count: number
}

export type TenantDetail = {
  id: string
  name: string
  domain: string | null
  address: {
    id: string | null
    address_line_1: string | null
    city: string | null
    state: string | null
    zip: string | null
    province_id: number | null
    city_id: number | null
  }
}

export type TenantUserRow = {
  tenant_user_id: string
  user_id: string
  name: string
  email: string
  role: string | null
}

export type UserSearchResult = {
  id: string
  name: string
  email: string
}

// ── List ──────────────────────────────────────────────────────────────────────

export async function getTenants(params: {
  page?: number
  pageSize?: number
  search?: string
  cityId?: string
  sortBy?: string
  sortDir?: string
} = {}): Promise<{ tenants: TenantRow[]; total: number }> {
  await requireAdmin()

  const page     = params.page     ?? 1
  const pageSize = params.pageSize ?? 20
  const offset   = (page - 1) * pageSize

  // ── WHERE ────────────────────────────────────────────────────────────────────
  const conditions: string[] = []
  const qParams: unknown[]   = []
  let idx = 1

  if (params.search) {
    conditions.push(`(t.name ILIKE $${idx} OR t.domain ILIKE $${idx})`)
    qParams.push(`%${params.search}%`)
    idx++
  }
  if (params.cityId) {
    conditions.push(
      `EXISTS (SELECT 1 FROM addresses WHERE tenant_id = t.id AND city_id = $${idx} LIMIT 1)`
    )
    qParams.push(parseInt(params.cityId, 10))
    idx++
  }

  const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : ''

  // ── ORDER BY ─────────────────────────────────────────────────────────────────
  const dir = params.sortDir === 'desc' ? 'DESC' : 'ASC'
  const orderBy = (() => {
    switch (params.sortBy) {
      case 'city':            return `city ${dir} NULLS LAST`
      case 'manager_count':   return `manager_count ${dir}`
      case 'operator_count':  return `operator_count ${dir}`
      default:                return `t.name ${dir}`   // 'name' or unset
    }
  })()

  // ── Correlated subqueries for role counts ─────────────────────────────────
  // Spatie standard: model_type = 'App\Models\TenantUser', model_id = tenant_user.id
  const roleCountSql = (roleName: string) => `
    (SELECT COUNT(DISTINCT tu.id)
     FROM tenant_user tu
     WHERE tu.tenant_id = t.id
       AND EXISTS (
         SELECT 1
         FROM model_has_roles mhr
         JOIN roles r ON r.id = mhr.role_id
         WHERE r.name = '${roleName}'
           AND mhr.model_type = 'App\\Models\\TenantUser'
           AND mhr.model_id = tu.id
       )
    )`

  const [rows, countResult] = await Promise.all([
    prisma.$queryRawUnsafe<{
      id: bigint
      name: string
      domain: string | null
      city: string | null
      manager_count: bigint
      operator_count: bigint
    }[]>(
      `SELECT
         t.id,
         t.name,
         t.domain,
         (SELECT rc.name FROM addresses a2 JOIN reg_cities rc ON rc.id = a2.city_id WHERE a2.tenant_id = t.id ORDER BY a2.id LIMIT 1) AS city,
         ${roleCountSql('manager')}  AS manager_count,
         ${roleCountSql('operator')} AS operator_count
       FROM tenants t
       ${where}
       ORDER BY ${orderBy}
       LIMIT $${idx} OFFSET $${idx + 1}`,
      ...qParams,
      pageSize,
      offset
    ),
    prisma.$queryRawUnsafe<{ count: bigint }[]>(
      `SELECT COUNT(*) AS count FROM tenants t ${where}`,
      ...qParams
    ),
  ])

  return {
    tenants: rows.map((r) => ({
      id: r.id.toString(),
      name: r.name,
      domain: r.domain,
      city: r.city,
      manager_count: Number(r.manager_count),
      operator_count: Number(r.operator_count),
    })),
    total: Number(countResult[0]?.count ?? 0),
  }
}

// ── Detail ────────────────────────────────────────────────────────────────────

export async function getTenantDetail(tenantId: string): Promise<TenantDetail | null> {
  await requireAdmin()

  const tenant = await prisma.tenants.findUnique({ where: { id: BigInt(tenantId) } })
  if (!tenant) return null

  const address = await prisma.addresses.findFirst({
    where: { tenant_id: BigInt(tenantId) },
    orderBy: { id: 'asc' },
  })

  return {
    id: tenant.id.toString(),
    name: tenant.name,
    domain: tenant.domain,
    address: {
      id: address?.id.toString() ?? null,
      address_line_1: address?.address_line_1 ?? null,
      city: address?.city ?? null,
      state: address?.state ?? null,
      zip: address?.zip ?? null,
      province_id: address?.province_id ?? null,
      city_id: address?.city_id ?? null,
    },
  }
}

// ── Tenant users ──────────────────────────────────────────────────────────────

export async function getTenantUsers(tenantId: string): Promise<TenantUserRow[]> {
  await requireAdmin()

  // Spatie standard: model_type = 'App\Models\TenantUser', model_id = tenant_user.id
  const rows = await prisma.$queryRawUnsafe<{
    tenant_user_id: bigint
    user_id: bigint
    name: string
    email: string
    role: string | null
  }[]>(
    `SELECT
       tu.id  AS tenant_user_id,
       u.id   AS user_id,
       u.name,
       u.email,
       (
         SELECT r.name
         FROM model_has_roles mhr
         JOIN roles r ON r.id = mhr.role_id
         WHERE mhr.model_type = 'App\\Models\\TenantUser'
           AND mhr.model_id = tu.id
         LIMIT 1
       ) AS role
     FROM tenant_user tu
     INNER JOIN users u ON u.id = tu.user_id
     WHERE tu.tenant_id = $1
     ORDER BY u.name ASC`,
    BigInt(tenantId)
  )

  return rows.map((r) => ({
    tenant_user_id: r.tenant_user_id.toString(),
    user_id: r.user_id.toString(),
    name: r.name,
    email: r.email,
    role: r.role,
  }))
}

// ── User search ───────────────────────────────────────────────────────────────

export async function searchUsersForTenant(
  query: string,
  tenantId: string
): Promise<UserSearchResult[]> {
  await requireAdmin()
  if (!query || query.trim().length < 2) return []

  const rows = await prisma.$queryRawUnsafe<{ id: bigint; name: string; email: string }[]>(
    `SELECT u.id, u.name, u.email
     FROM users u
     WHERE (u.name ILIKE $1 OR u.email ILIKE $1)
       AND u.is_blocked = false
       -- Belum terdaftar di tenant ini
       AND u.id NOT IN (
         SELECT user_id FROM tenant_user WHERE tenant_id = $2
       )
       -- Belum memiliki role (Spatie standard: model_id = tu.id)
       AND NOT EXISTS (
         SELECT 1
         FROM model_has_roles mhr
         JOIN roles r ON r.id = mhr.role_id AND r.name IN ('manager', 'operator')
         JOIN tenant_user tu ON tu.id = mhr.model_id
         WHERE mhr.model_type = 'App\\Models\\TenantUser'
           AND tu.user_id = u.id
       )
       -- Belum memiliki role (legacy: model_id = u.id)
       AND NOT EXISTS (
         SELECT 1
         FROM model_has_roles mhr
         JOIN roles r ON r.id = mhr.role_id AND r.name IN ('manager', 'operator')
         WHERE mhr.model_type = 'App\\Models\\TenantUser'
           AND mhr.model_id = u.id
       )
     ORDER BY u.name ASC
     LIMIT 10`,
    `%${query.trim()}%`,
    BigInt(tenantId)
  )

  return rows.map((r) => ({ id: r.id.toString(), name: r.name, email: r.email }))
}

// ── Provinces / cities for select ─────────────────────────────────────────────

export async function getProvincesForSelect(): Promise<{ id: number; name: string }[]> {
  await requireAdmin()
  const rows = await prisma.reg_provinces.findMany({ orderBy: { name: 'asc' } })
  return rows.map((p) => ({ id: p.id, name: p.name }))
}

export async function getCitiesForSelect(provinceId: number): Promise<{ id: string; name: string }[]> {
  await requireAdmin()
  const rows = await prisma.reg_cities.findMany({
    where: { province_id: provinceId },
    orderBy: { name: 'asc' },
  })
  return rows.map((c) => ({ id: c.id.toString(), name: c.name }))
}

export async function searchRegCities(query: string): Promise<{ id: string; name: string }[]> {
  await requireAdmin()
  if (!query || query.trim().length < 1) return []
  const rows = await prisma.reg_cities.findMany({
    where: { name: { contains: query.trim(), mode: 'insensitive' } },
    orderBy: { name: 'asc' },
    take: 20,
  })
  return rows.map((c) => ({ id: c.id.toString(), name: c.name }))
}

export async function getRegCityById(cityId: string): Promise<string | null> {
  await requireAdmin()
  const city = await prisma.reg_cities.findUnique({ where: { id: BigInt(cityId) } })
  return city?.name ?? null
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export async function updateTenant(
  tenantId: string,
  data: {
    name: string
    domain?: string
    address: {
      id?: string
      address_line_1?: string
      city?: string
      state?: string
      zip?: string
      province_id?: number | null
      city_id?: number | null
    }
  }
): Promise<void> {
  const admin = await requireAdmin()

  if (!data.name.trim()) throw new Error('Nama tenant tidak boleh kosong')

  await prisma.tenants.update({
    where: { id: BigInt(tenantId) },
    data: {
      name: data.name.trim(),
      domain: data.domain?.trim() || null,
    },
  })

  const { id: addressId, ...addressFields } = data.address
  const cleanAddress = {
    address_line_1: addressFields.address_line_1?.trim() || null,
    city: addressFields.city?.trim() || null,
    state: addressFields.state?.trim() || null,
    zip: addressFields.zip?.trim() || null,
    province_id: addressFields.province_id ?? null,
    city_id: addressFields.city_id ?? null,
  }

  if (addressId) {
    await prisma.addresses.update({ where: { id: BigInt(addressId) }, data: cleanAddress })
  } else {
    await prisma.addresses.create({
      data: { ...cleanAddress, tenant_id: BigInt(tenantId) },
    })
  }

  logEvent('info', 'tenant.updated', { adminId: admin.id, tenantId })
  revalidatePath('/settings/tenants')
}

export async function deleteTenant(tenantId: string): Promise<void> {
  const admin = await requireAdmin()

  // Guard: cannot delete if tenant has users with manager or operator role
  const result = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
    `SELECT COUNT(DISTINCT tu.id) AS count
     FROM tenant_user tu
     INNER JOIN model_has_roles mhr
       ON mhr.model_type = 'App\\Models\\TenantUser' AND mhr.model_id = tu.id
     INNER JOIN roles r ON r.id = mhr.role_id AND r.name IN ('manager', 'operator')
     WHERE tu.tenant_id = $1`,
    BigInt(tenantId)
  )

  if (Number(result[0]?.count ?? 0) > 0) {
    throw new Error('Tenant masih memiliki user (manager/operator). Hapus user terlebih dahulu.')
  }

  await prisma.tenants.delete({ where: { id: BigInt(tenantId) } })

  logEvent('warn', 'tenant.deleted', { adminId: admin.id, tenantId })
  revalidatePath('/settings/tenants')
}

export async function attachTenantUser(
  tenantId: string,
  userId: string,
  roleName: 'manager' | 'operator'
): Promise<void> {
  const admin = await requireAdmin()

  const existing = await prisma.tenant_user.findFirst({
    where: { tenant_id: BigInt(tenantId), user_id: BigInt(userId) },
  })
  if (existing) throw new Error('User sudah terdaftar di tenant ini.')

  const role = await prisma.roles.findFirst({
    where: { name: roleName },
    orderBy: [{ is_tenant_role: 'desc' }, { id: 'asc' }],
  })
  if (!role) throw new Error(`Role '${roleName}' tidak ditemukan di database.`)

  const tu = await prisma.tenant_user.create({
    data: { tenant_id: BigInt(tenantId), user_id: BigInt(userId) },
  })

  await prisma.model_has_roles.create({
    data: { role_id: role.id, model_type: MODEL_TYPE_TENANT_USER, model_id: tu.id },
  })

  logEvent('info', 'tenant.user_attached', { adminId: admin.id, tenantId, userId, roleName })
  revalidatePath('/settings/tenants')
}

export async function detachTenantUser(tenantUserId: string): Promise<void> {
  const admin = await requireAdmin()

  await prisma.model_has_roles.deleteMany({
    where: { model_type: MODEL_TYPE_TENANT_USER, model_id: BigInt(tenantUserId) },
  })
  await prisma.tenant_user.delete({ where: { id: BigInt(tenantUserId) } })

  logEvent('warn', 'tenant.user_detached', { adminId: admin.id, tenantUserId })
  revalidatePath('/settings/tenants')
}

export async function updateTenantUserRole(
  tenantUserId: string,
  roleName: 'manager' | 'operator'
): Promise<void> {
  const admin = await requireAdmin()

  const role = await prisma.roles.findFirst({
    where: { name: roleName },
    orderBy: [{ is_tenant_role: 'desc' }, { id: 'asc' }],
  })
  if (!role) throw new Error(`Role '${roleName}' tidak ditemukan di database.`)

  await prisma.model_has_roles.deleteMany({
    where: { model_type: MODEL_TYPE_TENANT_USER, model_id: BigInt(tenantUserId) },
  })
  await prisma.model_has_roles.create({
    data: { role_id: role.id, model_type: MODEL_TYPE_TENANT_USER, model_id: BigInt(tenantUserId) },
  })

  logEvent('info', 'tenant.user_role_updated', { adminId: admin.id, tenantUserId, roleName })
  revalidatePath('/settings/tenants')
}
