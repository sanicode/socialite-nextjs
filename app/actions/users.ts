'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/app/lib/authorization'
import { prisma } from '@/app/lib/prisma'
import { logEvent } from '@/app/lib/logger'
import type { Prisma } from '@/app/generated/prisma/client'
import bcrypt from 'bcryptjs'

const MODEL_TYPE_USER = 'App\\Models\\User'
const BULK_IMPORT_DOMAIN = 'bmi.com'
const MAX_BULK_IMPORT_ROWS = 500

export type RoleOption = {
  id: string
  name: string
}

export type UserRow = {
  id: string
  name: string
  email: string
  phone_number: string | null
  is_blocked: boolean
  is_admin: boolean
  direct_role_id: string | null
  direct_role_name: string | null
  last_seen_at: string | null
  active_failed_attempts: number
  is_under_attack: boolean
  is_rate_limited: boolean
}

export type GetUsersResult = {
  users: UserRow[]
  total: number
  totalBlocked: number
  totalUnderAttack: number
  totalRateLimited: number
}

export type BulkUserImportStatus = 'valid' | 'duplicate_existing' | 'duplicate_input' | 'invalid'

export type BulkUserImportRow = {
  line: number
  name: string
  phone_number: string
  email: string
  status: BulkUserImportStatus
  message: string
}

export type BulkUserImportPreview = {
  rows: BulkUserImportRow[]
  totalRows: number
  validRows: number
  duplicateExistingRows: number
  duplicateInputRows: number
  invalidRows: number
}

export type BulkUserImportResult = BulkUserImportPreview & {
  createdRows: number
  skippedRows: number
}

type ParsedBulkUserRow = {
  line: number
  name: string
  phone_number: string
  email: string
  status: BulkUserImportStatus
  message: string
}

function normalizeBulkPhone(value: string) {
  let phone = value.replace(/\D/g, '')
  if (phone.startsWith('62')) phone = `0${phone.slice(2)}`
  if (phone.startsWith('8')) phone = `0${phone}`
  return phone
}

function parseBulkUserLine(rawLine: string, line: number): ParsedBulkUserRow | null {
  const text = rawLine.trim()
  if (!text) return null

  let name = ''
  let rawPhone = ''

  if (text.includes('\t')) {
    const parts = text.split('\t').map((part) => part.trim())
    name = parts[0] ?? ''
    rawPhone = parts[1] ?? ''
  } else {
    const match = text.match(/^(.+?)\s+([+()0-9][+()0-9 .-]{7,})$/)
    name = match?.[1]?.trim() ?? ''
    rawPhone = match?.[2]?.trim() ?? ''
  }

  const phone = normalizeBulkPhone(rawPhone)
  const email = phone ? `${phone}@${BULK_IMPORT_DOMAIN}` : ''

  if (!name || !phone) {
    return {
      line,
      name,
      phone_number: phone,
      email,
      status: 'invalid',
      message: 'Format baris tidak valid.',
    }
  }

  if (name.length > 255) {
    return {
      line,
      name,
      phone_number: phone,
      email,
      status: 'invalid',
      message: 'Nama lebih dari 255 karakter.',
    }
  }

  if (!/^0\d{9,14}$/.test(phone)) {
    return {
      line,
      name,
      phone_number: phone,
      email,
      status: 'invalid',
      message: 'Nomor HP harus 10-15 digit dan diawali 0.',
    }
  }

  return {
    line,
    name,
    phone_number: phone,
    email,
    status: 'valid',
    message: 'Siap diimport.',
  }
}

function summarizeBulkImportRows(rows: BulkUserImportRow[]): BulkUserImportPreview {
  return {
    rows,
    totalRows: rows.length,
    validRows: rows.filter((row) => row.status === 'valid').length,
    duplicateExistingRows: rows.filter((row) => row.status === 'duplicate_existing').length,
    duplicateInputRows: rows.filter((row) => row.status === 'duplicate_input').length,
    invalidRows: rows.filter((row) => row.status === 'invalid').length,
  }
}

async function buildBulkUserImportPreview(rawText: string): Promise<BulkUserImportPreview> {
  const parsedRows = rawText
    .split(/\r?\n/)
    .map((line, index) => parseBulkUserLine(line, index + 1))
    .filter((row): row is ParsedBulkUserRow => row !== null)

  if (parsedRows.length > MAX_BULK_IMPORT_ROWS) {
    throw new Error(`Maksimal ${MAX_BULK_IMPORT_ROWS} user per import.`)
  }

  const seenEmails = new Set<string>()
  const candidateEmails: string[] = []
  const rowsWithInputDuplicates = parsedRows.map((row) => {
    if (row.status !== 'valid') return row
    if (seenEmails.has(row.email)) {
      return {
        ...row,
        status: 'duplicate_input' as const,
        message: 'Duplikat di data import.',
      }
    }
    seenEmails.add(row.email)
    candidateEmails.push(row.email)
    return row
  })

  const existingUsers = candidateEmails.length
    ? await prisma.users.findMany({
        where: { email: { in: candidateEmails } },
        select: { email: true },
      })
    : []
  const existingEmails = new Set(existingUsers.map((user) => user.email.toLowerCase()))

  const rows = rowsWithInputDuplicates.map((row): BulkUserImportRow => {
    if (row.status !== 'valid') return row
    if (existingEmails.has(row.email)) {
      return {
        ...row,
        status: 'duplicate_existing',
        message: 'Email sudah terdaftar.',
      }
    }
    return row
  })

  return summarizeBulkImportRows(rows)
}

export async function getUsers(params: {
  page?: number
  pageSize?: number
  search?: string
  status?: string   // 'active' | 'blocked' | '' (semua)
  loginSecurity?: string // 'has_attempts' | 'under_attack' | 'rate_limited'
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

  const counts = await prisma.$queryRaw<{ email: string; count: bigint }[]>`
    SELECT LOWER(email) AS email, COUNT(DISTINCT attempted_at)::bigint AS count
    FROM login_attempts
    WHERE attempted_at > NOW() - INTERVAL '1 hour'
      AND email IS NOT NULL
    GROUP BY LOWER(email)
  `

  const rateLimitedRows = await prisma.$queryRaw<{ email: string }[]>`
    WITH tier1 AS (
      SELECT LOWER(email) AS email
      FROM login_attempts
      WHERE attempted_at > NOW() - INTERVAL '10 minutes'
        AND email IS NOT NULL
        AND key LIKE LOWER(email) || '|%'
      GROUP BY LOWER(email), key
      HAVING COUNT(DISTINCT attempted_at) >= 5
    ),
    tier2_blocked_ips AS (
      SELECT key AS ip
      FROM login_attempts
      WHERE attempted_at > NOW() - INTERVAL '10 minutes'
        AND email IS NOT NULL
        AND key <> LOWER(email)
        AND key NOT LIKE LOWER(email) || '|%'
      GROUP BY key
      HAVING COUNT(DISTINCT attempted_at) >= 20
    ),
    tier2 AS (
      SELECT DISTINCT LOWER(la.email) AS email
      FROM login_attempts la
      INNER JOIN tier2_blocked_ips ip ON ip.ip = la.key
      WHERE la.attempted_at > NOW() - INTERVAL '10 minutes'
        AND la.email IS NOT NULL
    ),
    tier3 AS (
      SELECT LOWER(email) AS email
      FROM login_attempts
      WHERE attempted_at > NOW() - INTERVAL '60 minutes'
        AND email IS NOT NULL
      GROUP BY LOWER(email)
      HAVING COUNT(DISTINCT attempted_at) >= 50
    )
    SELECT DISTINCT email
    FROM (
      SELECT email FROM tier1
      UNION
      SELECT email FROM tier2
      UNION
      SELECT email FROM tier3
    ) rate_limited
  `

  const countMap = new Map(counts.map((r) => [r.email.toLowerCase(), Number(r.count)]))
  const totalUnderAttack = counts.filter((r) => Number(r.count) > 10).length
  const rateLimitedEmails = new Set(rateLimitedRows.map((row) => row.email.toLowerCase()))
  const totalRateLimited = rateLimitedEmails.size

  if (params.loginSecurity) {
    const matchingEmails =
      params.loginSecurity === 'has_attempts'
        ? counts
            .filter((row) => Number(row.count) > 0)
            .map((row) => row.email.toLowerCase())
        : params.loginSecurity === 'under_attack'
          ? counts
              .filter((row) => Number(row.count) > 10)
              .map((row) => row.email.toLowerCase())
          : params.loginSecurity === 'rate_limited'
            ? Array.from(rateLimitedEmails)
            : []

    if (matchingEmails.length === 0) {
      return {
        total: 0,
        totalBlocked: await prisma.users.count({ where: { is_blocked: true } }),
        totalUnderAttack,
        totalRateLimited,
        users: [],
      }
    }

    where.email = { in: matchingEmails }
  }

  const [users, total, totalBlocked] = await Promise.all([
    prisma.users.findMany({
      where,
      select: { id: true, name: true, email: true, phone_number: true, is_blocked: true, is_admin: true, last_seen_at: true },
      orderBy,
      take: pageSize,
      skip: offset,
    }),
    prisma.users.count({ where }),
    prisma.users.count({ where: { is_blocked: true } }),
  ])

  const roleAssignments = await prisma.model_has_roles.findMany({
    where: { model_type: MODEL_TYPE_USER, model_id: { in: users.map((u) => u.id) } },
    include: { roles: { select: { id: true, name: true } } },
  })
  const roleMap = new Map(
    roleAssignments.map((r) => [r.model_id.toString(), { id: r.role_id.toString(), name: r.roles.name }])
  )

  return {
    total,
    totalBlocked,
    totalUnderAttack,
    totalRateLimited,
    users: users.map((u) => ({
      id: u.id.toString(),
      name: u.name,
      email: u.email,
      phone_number: u.phone_number ?? null,
      is_blocked: u.is_blocked,
      is_admin: u.is_admin,
      direct_role_id: roleMap.get(u.id.toString())?.id ?? null,
      direct_role_name: roleMap.get(u.id.toString())?.name ?? null,
      last_seen_at: u.last_seen_at?.toISOString() ?? null,
      active_failed_attempts: countMap.get(u.email.toLowerCase()) ?? 0,
      is_under_attack: (countMap.get(u.email.toLowerCase()) ?? 0) > 10,
      is_rate_limited: rateLimitedEmails.has(u.email.toLowerCase()),
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

export async function getRolesForUserForm(): Promise<RoleOption[]> {
  await requireAdmin()
  const roles = await prisma.roles.findMany({
    where: { tenant_id: null },
    orderBy: { name: 'asc' },
  })
  return roles.map((r) => ({ id: r.id.toString(), name: r.name }))
}

export async function previewUsersBulkImportFromText(rawText: string): Promise<BulkUserImportPreview> {
  await requireAdmin()

  return buildBulkUserImportPreview(rawText)
}

export async function importUsersBulkFromText(rawText: string): Promise<BulkUserImportResult> {
  const admin = await requireAdmin()

  const preview = await buildBulkUserImportPreview(rawText)
  const rowsToCreate = preview.rows.filter((row) => row.status === 'valid')

  if (rowsToCreate.length === 0) {
    return {
      ...preview,
      createdRows: 0,
      skippedRows: preview.totalRows,
    }
  }

  const data = await Promise.all(
    rowsToCreate.map(async (row) => ({
      name: row.name,
      email: row.email,
      password: await bcrypt.hash(row.phone_number, 12),
      phone_number: row.phone_number,
      is_admin: false,
      is_blocked: false,
    }))
  )

  const result = await prisma.users.createMany({
    data,
    skipDuplicates: true,
  })

  logEvent('info', 'user.bulk_imported', {
    adminId: admin.id,
    source: 'text',
    created: result.count,
    skipped: preview.totalRows - result.count,
  })
  revalidatePath('/settings/users')

  return {
    ...preview,
    createdRows: result.count,
    skippedRows: preview.totalRows - result.count,
  }
}

export async function createUser(data: {
  name: string
  email: string
  phone_number: string
  password?: string
  role_id?: string
  is_admin?: boolean
}): Promise<void> {
  const admin = await requireAdmin()

  const name  = data.name.trim()
  const email = data.email.trim().toLowerCase()
  const phone = data.phone_number.trim()
  if (!name)  throw new Error('Nama tidak boleh kosong.')
  if (!email) throw new Error('Email tidak boleh kosong.')
  if (!phone) throw new Error('Nomor telp tidak boleh kosong.')

  const existing = await prisma.users.findUnique({ where: { email } })
  if (existing) throw new Error('Email sudah terdaftar.')

  const rawPassword = data.password?.trim() || phone
  const hashed = await bcrypt.hash(rawPassword, 12)

  const newUser = await prisma.users.create({
    data: {
      name,
      email,
      password: hashed,
      phone_number: phone,
      is_admin: data.is_admin ?? false,
      is_blocked: false,
    },
  })

  if (data.role_id) {
    await prisma.model_has_roles.create({
      data: { role_id: BigInt(data.role_id), model_type: MODEL_TYPE_USER, model_id: newUser.id },
    })
  }

  logEvent('info', 'user.created', { adminId: admin.id, email })
  revalidatePath('/settings/users')
}

export async function updateUser(
  userId: string,
  data: {
    name: string
    email: string
    phone_number: string
    password?: string
    role_id?: string | null
    is_admin?: boolean
  }
): Promise<void> {
  const admin = await requireAdmin()

  const name  = data.name.trim()
  const email = data.email.trim().toLowerCase()
  const phone = data.phone_number.trim()
  if (!name)  throw new Error('Nama tidak boleh kosong.')
  if (!email) throw new Error('Email tidak boleh kosong.')
  if (!phone) throw new Error('Nomor telp tidak boleh kosong.')

  const duplicate = await prisma.users.findFirst({
    where: { email, NOT: { id: BigInt(userId) } },
  })
  if (duplicate) throw new Error('Email sudah digunakan user lain.')

  const updateData: Prisma.usersUpdateInput = {
    name,
    email,
    phone_number: phone,
    is_admin: data.is_admin ?? false,
  }

  if (data.password?.trim()) {
    updateData.password = await bcrypt.hash(data.password.trim(), 12)
  }

  await prisma.users.update({ where: { id: BigInt(userId) }, data: updateData })

  await prisma.model_has_roles.deleteMany({
    where: { model_type: MODEL_TYPE_USER, model_id: BigInt(userId) },
  })
  if (data.role_id) {
    await prisma.model_has_roles.create({
      data: { role_id: BigInt(data.role_id), model_type: MODEL_TYPE_USER, model_id: BigInt(userId) },
    })
  }

  logEvent('info', 'user.updated', { adminId: admin.id, userId, email })
  revalidatePath('/settings/users')
}
