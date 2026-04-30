import { requireJwtRole, apiError, ApiError, requireApiEnabled } from '@/app/lib/api-auth'
import { prisma } from '@/app/lib/prisma'

const DOMAIN = 'bmi.com'
const MAX_ROWS = 500
const MODEL_TYPE_TENANT_USER = 'App\\Models\\TenantUser'

type ImportStatus =
  | 'valid' | 'duplicate_input' | 'not_found' | 'blocked'
  | 'already_in_tenant' | 'already_has_tenant_role' | 'invalid'

type ParsedRow = {
  line: number
  phone_number: string
  email: string
  user_id: string | null
  tenant_user_id: string | null
  name: string | null
  status: ImportStatus
  message: string
}

function normalizePhone(value: string) {
  let phone = value.replace(/\D/g, '')
  if (phone.startsWith('62')) phone = `0${phone.slice(2)}`
  if (phone.startsWith('8')) phone = `0${phone}`
  return phone
}

function parseLine(rawLine: string, line: number): { phone: string; email: string } | null {
  const text = rawLine.trim()
  if (!text) return null
  const phone = normalizePhone(text)
  if (!/^0\d{9,14}$/.test(phone)) return null
  return { phone, email: `${phone}@${DOMAIN}` }
}

export async function buildTenantOperatorImportPreview(tenantId: string, rawText: string) {
  const tenantBigId = BigInt(tenantId)
  const lines = rawText.split(/\r?\n/)

  const parsedRows: ParsedRow[] = []
  for (let i = 0; i < lines.length; i++) {
    const text = lines[i].trim()
    if (!text) continue
    const phone = normalizePhone(text)
    const email = phone ? `${phone}@${DOMAIN}` : ''
    if (!/^0\d{9,14}$/.test(phone)) {
      parsedRows.push({ line: i + 1, phone_number: phone, email, user_id: null, tenant_user_id: null, name: null, status: 'invalid', message: 'Nomor HP harus 10-15 digit dan diawali 0.' })
    } else {
      parsedRows.push({ line: i + 1, phone_number: phone, email, user_id: null, tenant_user_id: null, name: null, status: 'valid', message: 'Siap diimport.' })
    }
  }

  if (parsedRows.length > MAX_ROWS) throw new ApiError(400, `Maksimal ${MAX_ROWS} operator per import.`)

  const seenPhones = new Set<string>()
  const phones: string[] = []
  const emails: string[] = []
  const deduped = parsedRows.map((row) => {
    if (row.status !== 'valid') return row
    if (seenPhones.has(row.phone_number)) {
      return { ...row, status: 'duplicate_input' as const, message: 'Duplikat di data import.' }
    }
    seenPhones.add(row.phone_number)
    phones.push(row.phone_number)
    emails.push(row.email)
    return row
  })

  const users = phones.length
    ? await prisma.users.findMany({
        where: { OR: [{ email: { in: emails } }, { phone_number: { in: phones } }] },
        select: { id: true, name: true, email: true, phone_number: true, is_blocked: true },
      })
    : []

  const userByKey = new Map<string, (typeof users)[number]>()
  for (const u of users) {
    userByKey.set(u.email.toLowerCase(), u)
    if (u.phone_number) userByKey.set(normalizePhone(u.phone_number), u)
  }

  const tenantUsers = users.length
    ? await prisma.tenant_user.findMany({
        where: { user_id: { in: users.map((u) => u.id) } },
        select: { id: true, tenant_id: true, user_id: true },
      })
    : []

  const currentTUByUserId = new Map(
    tenantUsers.filter((tu) => tu.tenant_id === tenantBigId).map((tu) => [tu.user_id.toString(), tu])
  )

  const roleAssignments = tenantUsers.length
    ? await prisma.model_has_roles.findMany({
        where: { model_type: MODEL_TYPE_TENANT_USER, model_id: { in: tenantUsers.map((tu) => tu.id) } },
        select: { model_id: true, roles: { select: { name: true } } },
      })
    : []

  const tuById = new Map(tenantUsers.map((tu) => [tu.id.toString(), tu]))
  const rolesByTUID = new Map<string, string[]>()
  for (const a of roleAssignments) {
    const key = a.model_id.toString()
    rolesByTUID.set(key, [...(rolesByTUID.get(key) ?? []), a.roles.name])
  }
  const userIdsWithTenantRoles = new Set(
    roleAssignments
      .map((a) => tuById.get(a.model_id.toString())?.user_id.toString())
      .filter((id): id is string => Boolean(id))
  )

  const finalRows = deduped.map((row): ParsedRow => {
    const user = userByKey.get(row.phone_number) ?? userByKey.get(row.email)
    if (row.status !== 'valid') {
      return { ...row, user_id: user?.id.toString() ?? null, name: user?.name ?? null, tenant_user_id: user ? currentTUByUserId.get(user.id.toString())?.id.toString() ?? null : null }
    }
    if (!user) return { ...row, user_id: null, tenant_user_id: null, name: null, status: 'not_found', message: 'User tidak ditemukan.' }
    const uid = user.id.toString()
    if (user.is_blocked) return { ...row, user_id: uid, tenant_user_id: currentTUByUserId.get(uid)?.id.toString() ?? null, name: user.name, status: 'blocked', message: 'User sedang diblokir.' }
    const currentTU = currentTUByUserId.get(uid)
    const currentRoles = currentTU ? rolesByTUID.get(currentTU.id.toString()) ?? [] : []
    if (currentTU && currentRoles.includes('operator')) {
      return { ...row, user_id: uid, tenant_user_id: currentTU.id.toString(), name: user.name, status: 'already_in_tenant', message: 'User sudah terdaftar sebagai operator di tenant ini.' }
    }
    if (currentTU && currentRoles.length > 0) {
      return { ...row, user_id: uid, tenant_user_id: currentTU.id.toString(), name: user.name, status: 'already_in_tenant', message: `User sudah terdaftar sebagai ${currentRoles.join(', ')} di tenant ini.` }
    }
    if (userIdsWithTenantRoles.has(uid)) {
      return { ...row, user_id: uid, tenant_user_id: null, name: user.name, status: 'already_has_tenant_role', message: 'User sudah memiliki role tenant_user.' }
    }
    return { ...row, user_id: uid, tenant_user_id: null, name: user.name }
  })

  const operatorTotalRows = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(DISTINCT tu.id)::bigint AS count
    FROM tenant_user tu
    INNER JOIN model_has_roles mhr ON mhr.model_type = ${MODEL_TYPE_TENANT_USER} AND mhr.model_id = tu.id
    INNER JOIN roles r ON r.id = mhr.role_id AND r.name = 'operator'
    WHERE tu.tenant_id = ${tenantBigId}
  `.then((r) => Number(r[0]?.count ?? 0))

  return {
    rows: finalRows,
    totalRows: finalRows.length,
    operatorTotalRows,
    validRows: finalRows.filter((r) => r.status === 'valid').length,
    duplicateInputRows: finalRows.filter((r) => r.status === 'duplicate_input').length,
    notFoundRows: finalRows.filter((r) => r.status === 'not_found').length,
    blockedRows: finalRows.filter((r) => r.status === 'blocked').length,
    alreadyInTenantRows: finalRows.filter((r) => r.status === 'already_in_tenant').length,
    alreadyHasTenantRoleRows: finalRows.filter((r) => r.status === 'already_has_tenant_role').length,
    invalidRows: finalRows.filter((r) => r.status === 'invalid').length,
  }
}

type Ctx = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: Ctx) {
  try {
    await requireApiEnabled()
    await requireJwtRole(request, 'admin')
    const { id } = await params
    const body = await request.json()
    if (!body.text || typeof body.text !== 'string') throw new ApiError(400, 'Field "text" wajib diisi.')
    const preview = await buildTenantOperatorImportPreview(id, body.text)
    return Response.json(preview)
  } catch (error) {
    return apiError(error)
  }
}
