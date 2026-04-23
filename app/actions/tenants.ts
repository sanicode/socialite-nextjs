'use server'

import { randomUUID } from 'crypto'
import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/app/lib/authorization'
import { prisma } from '@/app/lib/prisma'
import { logEvent } from '@/app/lib/logger'

// Used when creating/deleting role assignments via Prisma (not inline SQL)
const MODEL_TYPE_TENANT_USER = 'App\\Models\\TenantUser'
const TENANT_OPERATOR_IMPORT_DOMAIN = 'bmi.com'
const MAX_TENANT_OPERATOR_IMPORT_ROWS = 500

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

export type TenantFormData = {
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

export type TenantOperatorImportStatus =
  | 'valid'
  | 'duplicate_input'
  | 'not_found'
  | 'blocked'
  | 'already_in_tenant'
  | 'already_has_tenant_role'
  | 'invalid'

export type TenantOperatorImportRow = {
  line: number
  phone_number: string
  email: string
  user_id: string | null
  tenant_user_id: string | null
  name: string | null
  status: TenantOperatorImportStatus
  message: string
}

export type TenantOperatorImportPreview = {
  rows: TenantOperatorImportRow[]
  totalRows: number
  operatorTotalRows: number
  validRows: number
  duplicateInputRows: number
  notFoundRows: number
  blockedRows: number
  alreadyInTenantRows: number
  alreadyHasTenantRoleRows: number
  invalidRows: number
}

export type TenantOperatorImportResult = TenantOperatorImportPreview & {
  createdRows: number
  skippedRows: number
}

type ParsedOperatorImportRow = {
  line: number
  phone_number: string
  email: string
  status: TenantOperatorImportStatus
  message: string
}

async function getTenantRoleCount(tenantId: string, roleName: 'manager' | 'operator') {
  const result = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(DISTINCT tu.id)::bigint AS count
    FROM tenant_user tu
    INNER JOIN model_has_roles mhr
      ON mhr.model_type = ${MODEL_TYPE_TENANT_USER}
     AND mhr.model_id = tu.id
    INNER JOIN roles r
      ON r.id = mhr.role_id
     AND r.name = ${roleName}
    WHERE tu.tenant_id = ${BigInt(tenantId)}
  `

  return Number(result[0]?.count ?? 0)
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

function normalizeImportPhone(value: string) {
  let phone = value.replace(/\D/g, '')
  if (phone.startsWith('62')) phone = `0${phone.slice(2)}`
  if (phone.startsWith('8')) phone = `0${phone}`
  return phone
}

function parseOperatorImportLine(rawLine: string, line: number): ParsedOperatorImportRow | null {
  const text = rawLine.trim()
  if (!text) return null

  const phone = normalizeImportPhone(text)
  const email = phone ? `${phone}@${TENANT_OPERATOR_IMPORT_DOMAIN}` : ''

  if (!/^0\d{9,14}$/.test(phone)) {
    return {
      line,
      phone_number: phone,
      email,
      status: 'invalid',
      message: 'Nomor HP harus 10-15 digit dan diawali 0.',
    }
  }

  return {
    line,
    phone_number: phone,
    email,
    status: 'valid',
    message: 'Siap diimport.',
  }
}

function summarizeOperatorImportRows(
  rows: TenantOperatorImportRow[],
  operatorTotalRows: number
): TenantOperatorImportPreview {
  return {
    rows,
    totalRows: rows.length,
    operatorTotalRows,
    validRows: rows.filter((row) => row.status === 'valid').length,
    duplicateInputRows: rows.filter((row) => row.status === 'duplicate_input').length,
    notFoundRows: rows.filter((row) => row.status === 'not_found').length,
    blockedRows: rows.filter((row) => row.status === 'blocked').length,
    alreadyInTenantRows: rows.filter((row) => row.status === 'already_in_tenant').length,
    alreadyHasTenantRoleRows: rows.filter((row) => row.status === 'already_has_tenant_role').length,
    invalidRows: rows.filter((row) => row.status === 'invalid').length,
  }
}

async function buildTenantOperatorImportPreview(
  tenantId: string,
  rawText: string
): Promise<TenantOperatorImportPreview> {
  const tenantBigId = BigInt(tenantId)
  const parsedRows = rawText
    .split(/\r?\n/)
    .map((line, index) => parseOperatorImportLine(line, index + 1))
    .filter((row): row is ParsedOperatorImportRow => row !== null)

  if (parsedRows.length > MAX_TENANT_OPERATOR_IMPORT_ROWS) {
    throw new Error(`Maksimal ${MAX_TENANT_OPERATOR_IMPORT_ROWS} operator per import.`)
  }

  const seenPhones = new Set<string>()
  const phones: string[] = []
  const emails: string[] = []
  const rowsWithInputDuplicates = parsedRows.map((row) => {
    if (row.status !== 'valid') return row
    if (seenPhones.has(row.phone_number)) {
      return {
        ...row,
        status: 'duplicate_input' as const,
        message: 'Duplikat di data import.',
      }
    }
    seenPhones.add(row.phone_number)
    phones.push(row.phone_number)
    emails.push(row.email)
    return row
  })

  const users = phones.length
    ? await prisma.users.findMany({
        where: {
          OR: [
            { email: { in: emails } },
            { phone_number: { in: phones } },
          ],
        },
        select: { id: true, name: true, email: true, phone_number: true, is_blocked: true },
      })
    : []

  const userByPhoneOrEmail = new Map<string, (typeof users)[number]>()
  for (const user of users) {
    userByPhoneOrEmail.set(user.email.toLowerCase(), user)
    if (user.phone_number) userByPhoneOrEmail.set(normalizeImportPhone(user.phone_number), user)
  }

  const userIds = users.map((user) => user.id)
  const tenantUsers = userIds.length
    ? await prisma.tenant_user.findMany({
        where: { user_id: { in: userIds } },
        select: { id: true, tenant_id: true, user_id: true },
      })
    : []

  const currentTenantUserByUserId = new Map(
    tenantUsers
      .filter((tu) => tu.tenant_id === tenantBigId)
      .map((tu) => [tu.user_id.toString(), tu])
  )

  const tenantUserIds = tenantUsers.map((tu) => tu.id)
  const roleAssignments = tenantUserIds.length
    ? await prisma.model_has_roles.findMany({
        where: {
          model_type: MODEL_TYPE_TENANT_USER,
          model_id: { in: tenantUserIds },
        },
        select: { model_id: true, roles: { select: { name: true } } },
      })
    : []

  const tenantUserIdById = new Map(tenantUsers.map((tu) => [tu.id.toString(), tu]))
  const roleNamesByTenantUserId = new Map<string, string[]>()
  for (const assignment of roleAssignments) {
    const key = assignment.model_id.toString()
    roleNamesByTenantUserId.set(key, [
      ...(roleNamesByTenantUserId.get(key) ?? []),
      assignment.roles.name,
    ])
  }
  const userIdsWithTenantRoles = new Set(
    roleAssignments
      .map((role) => tenantUserIdById.get(role.model_id.toString())?.user_id.toString())
      .filter((userId): userId is string => Boolean(userId))
  )

  const rows = rowsWithInputDuplicates.map((row): TenantOperatorImportRow => {
    const user = userByPhoneOrEmail.get(row.phone_number) ?? userByPhoneOrEmail.get(row.email)

    if (row.status !== 'valid') {
      return {
        ...row,
        user_id: user?.id.toString() ?? null,
        tenant_user_id: user ? currentTenantUserByUserId.get(user.id.toString())?.id.toString() ?? null : null,
        name: user?.name ?? null,
      }
    }

    if (!user) {
      return {
        ...row,
        user_id: null,
        tenant_user_id: null,
        name: null,
        status: 'not_found',
        message: 'User tidak ditemukan.',
      }
    }

    const userId = user.id.toString()
    if (user.is_blocked) {
      return {
        ...row,
        user_id: userId,
        tenant_user_id: currentTenantUserByUserId.get(userId)?.id.toString() ?? null,
        name: user.name,
        status: 'blocked',
        message: 'User sedang diblokir.',
      }
    }

    const currentTenantUser = currentTenantUserByUserId.get(userId)
    const currentTenantRoles = currentTenantUser
      ? roleNamesByTenantUserId.get(currentTenantUser.id.toString()) ?? []
      : []

    if (currentTenantUser && currentTenantRoles.includes('operator')) {
      return {
        ...row,
        user_id: userId,
        tenant_user_id: currentTenantUser.id.toString(),
        name: user.name,
        status: 'already_in_tenant',
        message: 'User sudah terdaftar sebagai operator di tenant ini.',
      }
    }

    if (currentTenantUser && currentTenantRoles.length === 0) {
      return {
        ...row,
        user_id: userId,
        tenant_user_id: currentTenantUser.id.toString(),
        name: user.name,
        message: 'Tenant user sudah ada tanpa role; role operator akan dilengkapi.',
      }
    }

    if (currentTenantUser) {
      return {
        ...row,
        user_id: userId,
        tenant_user_id: currentTenantUser.id.toString(),
        name: user.name,
        status: 'already_in_tenant',
        message: `User sudah terdaftar sebagai ${currentTenantRoles.join(', ')} di tenant ini.`,
      }
    }

    if (userIdsWithTenantRoles.has(userId)) {
      return {
        ...row,
        user_id: userId,
        tenant_user_id: null,
        name: user.name,
        status: 'already_has_tenant_role',
        message: 'User sudah memiliki role tenant_user.',
      }
    }

    return {
      ...row,
      user_id: userId,
      tenant_user_id: null,
      name: user.name,
    }
  })

  const operatorTotalRows = await getTenantRoleCount(tenantId, 'operator')

  return summarizeOperatorImportRows(rows, operatorTotalRows)
}

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
       -- Belum pernah memiliki role tenant_user apa pun
       AND NOT EXISTS (
         SELECT 1
         FROM model_has_roles mhr
         JOIN tenant_user tu ON tu.id = mhr.model_id
         WHERE mhr.model_type = 'App\\Models\\TenantUser'
           AND tu.user_id = u.id
       )
     ORDER BY u.name ASC
     LIMIT 10`,
    `%${query.trim()}%`,
    BigInt(tenantId)
  )

  return rows.map((r) => ({ id: r.id.toString(), name: r.name, email: r.email }))
}

export async function previewTenantOperatorImportFromText(
  tenantId: string,
  rawText: string
): Promise<TenantOperatorImportPreview> {
  await requireAdmin()

  return buildTenantOperatorImportPreview(tenantId, rawText)
}

export async function importTenantOperatorsFromText(
  tenantId: string,
  rawText: string
): Promise<TenantOperatorImportResult> {
  const admin = await requireAdmin()

  const preview = await buildTenantOperatorImportPreview(tenantId, rawText)
  const rowsToImport = preview.rows.filter(
    (row): row is TenantOperatorImportRow & { user_id: string; name: string } =>
      row.status === 'valid' && row.user_id !== null && row.name !== null
  )

  if (rowsToImport.length === 0) {
    return {
      ...preview,
      createdRows: 0,
      skippedRows: preview.totalRows,
    }
  }

  const role = await prisma.roles.findFirst({
    where: { name: 'operator' },
    orderBy: [{ is_tenant_role: 'desc' }, { id: 'asc' }],
  })
  if (!role) throw new Error("Role 'operator' tidak ditemukan di database.")

  const newUserIds = rowsToImport
    .filter((row) => row.tenant_user_id === null)
    .map((row) => BigInt(row.user_id))
  const existingTenantUserIds = rowsToImport
    .filter((row) => row.tenant_user_id !== null)
    .map((row) => BigInt(row.tenant_user_id as string))
  const insertResult = await prisma.$queryRaw<{ count: bigint }[]>`
    WITH existing_tenant_user(id) AS (
      SELECT DISTINCT UNNEST(${existingTenantUserIds}::bigint[])
    ),
    eligible_existing AS (
      SELECT tu.id
      FROM existing_tenant_user e
      INNER JOIN tenant_user tu ON tu.id = e.id
      INNER JOIN users u ON u.id = tu.user_id
      WHERE tu.tenant_id = ${BigInt(tenantId)}
        AND u.is_blocked = false
        AND NOT EXISTS (
          SELECT 1
          FROM model_has_roles mhr
          WHERE mhr.model_type = ${MODEL_TYPE_TENANT_USER}
            AND mhr.model_id = tu.id
        )
    ),
    candidate(user_id) AS (
      SELECT DISTINCT UNNEST(${newUserIds}::bigint[])
    ),
    eligible AS (
      SELECT c.user_id
      FROM candidate c
      INNER JOIN users u ON u.id = c.user_id
      WHERE u.is_blocked = false
        AND NOT EXISTS (
          SELECT 1
          FROM tenant_user tu
          WHERE tu.tenant_id = ${BigInt(tenantId)}
            AND tu.user_id = c.user_id
        )
        AND NOT EXISTS (
          SELECT 1
          FROM tenant_user tu
          INNER JOIN model_has_roles mhr
            ON mhr.model_type = ${MODEL_TYPE_TENANT_USER}
           AND mhr.model_id = tu.id
          WHERE tu.user_id = c.user_id
        )
    ),
    inserted_tenant_users AS (
      INSERT INTO tenant_user (tenant_id, user_id, created_at, updated_at)
      SELECT ${BigInt(tenantId)}, user_id, NOW(), NOW()
      FROM eligible
      RETURNING id
    ),
    inserted_roles AS (
      INSERT INTO model_has_roles (role_id, model_type, model_id)
      SELECT ${role.id}, ${MODEL_TYPE_TENANT_USER}, id
      FROM (
        SELECT id FROM eligible_existing
        UNION
        SELECT id FROM inserted_tenant_users
      ) target_tenant_users
      ON CONFLICT DO NOTHING
      RETURNING model_id
    )
    SELECT COUNT(*)::bigint AS count
    FROM inserted_roles
  `
  const createdRows = Number(insertResult[0]?.count ?? 0)
  const operatorTotalRows = await getTenantRoleCount(tenantId, 'operator')

  logEvent('info', 'tenant.operator_bulk_imported', {
    adminId: admin.id,
    tenantId,
    created: createdRows,
    skipped: preview.totalRows - createdRows,
  })
  revalidatePath('/settings/tenants')

  return {
    ...preview,
    operatorTotalRows,
    createdRows,
    skippedRows: preview.totalRows - createdRows,
  }
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

function cleanTenantFormData(data: TenantFormData) {
  const name = data.name.trim()
  if (!name) throw new Error('Nama tenant tidak boleh kosong')

  const domain = data.domain?.trim() || null
  const { id: addressId, ...addressFields } = data.address
  const address = {
    address_line_1: addressFields.address_line_1?.trim() || null,
    city: addressFields.city?.trim() || null,
    state: addressFields.state?.trim() || null,
    zip: addressFields.zip?.trim() || null,
    province_id: addressFields.province_id ?? null,
    city_id: addressFields.city_id ?? null,
  }

  return { name, domain, addressId, address }
}

export async function createTenant(data: TenantFormData): Promise<void> {
  const admin = await requireAdmin()

  const { name, domain, address } = cleanTenantFormData(data)

  if (domain) {
    const existing = await prisma.tenants.findUnique({ where: { domain } })
    if (existing) throw new Error('Domain sudah digunakan tenant lain.')
  }

  const tenant = await prisma.$transaction(async (tx) => {
    const createdTenant = await tx.tenants.create({
      data: {
        uuid: randomUUID(),
        name,
        domain,
        created_by: BigInt(admin.id),
        created_at: new Date(),
        updated_at: new Date(),
      },
    })

    await tx.addresses.create({
      data: {
        ...address,
        tenant_id: createdTenant.id,
        created_at: new Date(),
        updated_at: new Date(),
      },
    })

    return createdTenant
  })

  logEvent('info', 'tenant.created', { adminId: admin.id, tenantId: tenant.id.toString() })
  revalidatePath('/settings/tenants')
}

export async function updateTenant(
  tenantId: string,
  data: TenantFormData
): Promise<void> {
  const admin = await requireAdmin()

  const { name, domain, addressId, address } = cleanTenantFormData(data)

  await prisma.tenants.update({
    where: { id: BigInt(tenantId) },
    data: {
      name,
      domain,
      updated_at: new Date(),
    },
  })

  if (addressId) {
    await prisma.addresses.update({
      where: { id: BigInt(addressId) },
      data: { ...address, updated_at: new Date() },
    })
  } else {
    await prisma.addresses.create({
      data: {
        ...address,
        tenant_id: BigInt(tenantId),
        created_at: new Date(),
        updated_at: new Date(),
      },
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
