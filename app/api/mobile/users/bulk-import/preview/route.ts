import { requireJwtRole, apiError, ApiError, requireApiEnabled } from '@/app/lib/api-auth'
import { prisma } from '@/app/lib/prisma'

const BULK_IMPORT_DOMAIN = 'bmi.com'
const MAX_BULK_IMPORT_ROWS = 500

type BulkUserImportStatus = 'valid' | 'duplicate_existing' | 'duplicate_input' | 'invalid'

type ParsedRow = {
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

function parseLine(rawLine: string, line: number): ParsedRow | null {
  const text = rawLine.trim()
  if (!text) return null

  let name = ''
  let rawPhone = ''

  if (text.includes('\t')) {
    const parts = text.split('\t').map((p) => p.trim())
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
    return { line, name, phone_number: phone, email, status: 'invalid', message: 'Format baris tidak valid.' }
  }
  if (name.length > 255) {
    return { line, name, phone_number: phone, email, status: 'invalid', message: 'Nama lebih dari 255 karakter.' }
  }
  if (!/^0\d{9,14}$/.test(phone)) {
    return { line, name, phone_number: phone, email, status: 'invalid', message: 'Nomor HP harus 10-15 digit dan diawali 0.' }
  }
  return { line, name, phone_number: phone, email, status: 'valid', message: 'Siap diimport.' }
}

export async function buildBulkUserImportPreview(rawText: string) {
  const parsedRows = rawText
    .split(/\r?\n/)
    .map((line, i) => parseLine(line, i + 1))
    .filter((r): r is ParsedRow => r !== null)

  if (parsedRows.length > MAX_BULK_IMPORT_ROWS) {
    throw new ApiError(400, `Maksimal ${MAX_BULK_IMPORT_ROWS} user per import.`)
  }

  const firstLineByEmail = new Map<string, number>()
  const candidateEmails: string[] = []
  const rows = parsedRows.map((row) => {
    if (row.status !== 'valid') return row
    const firstLine = firstLineByEmail.get(row.email)
    if (firstLine) {
      return { ...row, status: 'duplicate_input' as const, message: `Duplikat di data import dengan baris ${firstLine}.` }
    }
    firstLineByEmail.set(row.email, row.line)
    candidateEmails.push(row.email)
    return row
  })

  const existingUsers = candidateEmails.length
    ? await prisma.users.findMany({
        where: { email: { in: candidateEmails } },
        select: { id: true, email: true },
      })
    : []
  const existingByEmail = new Map(existingUsers.map((u) => [u.email.toLowerCase(), u]))
  const existingUserIds = existingUsers.map((u) => u.id)
  const tenantRows = existingUserIds.length
    ? await prisma.$queryRaw<{ user_id: bigint; tenant_name: string }[]>`
        SELECT tu.user_id, t.name AS tenant_name
        FROM tenant_user tu
        INNER JOIN tenants t ON t.id = tu.tenant_id
        WHERE tu.user_id = ANY(${existingUserIds}::bigint[])
        ORDER BY t.name ASC
      `
    : []
  const tenantsByUserId = new Map<string, string[]>()
  for (const r of tenantRows) {
    const key = r.user_id.toString()
    tenantsByUserId.set(key, [...(tenantsByUserId.get(key) ?? []), r.tenant_name])
  }

  const finalRows = rows.map((row): ParsedRow => {
    if (row.status !== 'valid') return row
    const existing = existingByEmail.get(row.email)
    if (existing) {
      const tenantNames = tenantsByUserId.get(existing.id.toString()) ?? []
      return {
        ...row,
        status: 'duplicate_existing',
        message: tenantNames.length
          ? `Email sudah terdaftar di tenant: ${tenantNames.join(', ')}.`
          : 'Email sudah terdaftar, belum terdaftar di tenant.',
      }
    }
    return row
  })

  return {
    rows: finalRows,
    totalRows: finalRows.length,
    validRows: finalRows.filter((r) => r.status === 'valid').length,
    duplicateExistingRows: finalRows.filter((r) => r.status === 'duplicate_existing').length,
    duplicateInputRows: finalRows.filter((r) => r.status === 'duplicate_input').length,
    invalidRows: finalRows.filter((r) => r.status === 'invalid').length,
  }
}

export async function POST(request: Request) {
  try {
    await requireApiEnabled()
    await requireJwtRole(request, 'admin')
    const body = await request.json()
    if (!body.text || typeof body.text !== 'string') {
      throw new ApiError(400, 'Field "text" wajib diisi.')
    }
    const preview = await buildBulkUserImportPreview(body.text)
    return Response.json(preview)
  } catch (error) {
    return apiError(error)
  }
}
