import { requireJwtRole, apiError, ApiError, requireApiEnabled } from '@/app/lib/api-auth'
import { prisma } from '@/app/lib/prisma'
import { logEvent } from '@/app/lib/logger'

const MODEL_TYPE_TENANT_USER = 'App\\Models\\TenantUser'

async function getCallerTenantId(userId: string): Promise<bigint> {
  const tu = await prisma.tenant_user.findFirst({
    where: { user_id: BigInt(userId) },
    select: { tenant_id: true },
  })
  if (!tu) throw new ApiError(403, 'User tidak terdaftar di tenant manapun.')
  return tu.tenant_id
}

// ── GET /api/mobile/operators ─────────────────────────────────────────────────

export async function GET(request: Request) {
  try {
    await requireApiEnabled()
    const payload = requireJwtRole(request, 'admin', 'manager')
    const { searchParams } = new URL(request.url)

    const page     = Math.max(1, Number(searchParams.get('page') ?? '1') || 1)
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize') ?? '20') || 20))
    const offset   = (page - 1) * pageSize
    const search   = searchParams.get('search') ?? undefined
    const email    = searchParams.get('email') ?? undefined
    const phone    = searchParams.get('phone') ?? undefined

    const tenantId = await getCallerTenantId(payload.sub)

    const conditions: string[] = [
      `tu.tenant_id = $1`,
      `mhr.model_type = 'App\\Models\\TenantUser'`,
      `r.name = 'operator'`,
      `mhr.model_id = tu.id`,
    ]
    const qParams: unknown[] = [tenantId]
    let idx = 2

    if (search) { conditions.push(`u.name ILIKE $${idx}`); qParams.push(`%${search}%`); idx++ }
    if (email)  { conditions.push(`u.email ILIKE $${idx}`); qParams.push(`%${email}%`); idx++ }
    if (phone)  { conditions.push(`u.phone_number ILIKE $${idx}`); qParams.push(`%${phone}%`); idx++ }

    const where = conditions.join(' AND ')

    const [rows, countResult] = await Promise.all([
      prisma.$queryRawUnsafe<{
        tenant_user_id: bigint; user_id: bigint; name: string; email: string; phone_number: string | null
      }[]>(
        `SELECT tu.id AS tenant_user_id, u.id AS user_id, u.name, u.email, u.phone_number
         FROM tenant_user tu
         INNER JOIN users u ON u.id = tu.user_id
         INNER JOIN model_has_roles mhr ON mhr.model_id = tu.id
         INNER JOIN roles r ON r.id = mhr.role_id
         WHERE ${where}
         ORDER BY u.name ASC
         LIMIT $${idx} OFFSET $${idx + 1}`,
        ...qParams, pageSize, offset
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

    return Response.json({
      operators: rows.map((r) => ({
        tenant_user_id: r.tenant_user_id.toString(),
        user_id: r.user_id.toString(),
        name: r.name,
        email: r.email,
        phone_number: r.phone_number,
      })),
      total: Number(countResult[0]?.count ?? 0),
    })
  } catch (error) {
    return apiError(error)
  }
}

// ── POST /api/mobile/operators ────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    await requireApiEnabled()
    const payload = requireJwtRole(request, 'admin', 'manager')
    const body = await request.json()

    if (!body.user_id) throw new ApiError(422, 'user_id wajib diisi.')

    const tenantId = await getCallerTenantId(payload.sub)

    const existing = await prisma.tenant_user.findFirst({
      where: { tenant_id: tenantId, user_id: BigInt(body.user_id) },
    })
    if (existing) throw new ApiError(409, 'User sudah terdaftar di tenant ini.')

    const role = await prisma.roles.findFirst({
      where: { name: 'operator' },
      orderBy: [{ is_tenant_role: 'desc' }, { id: 'asc' }],
    })
    if (!role) throw new ApiError(500, "Role 'operator' tidak ditemukan di database.")

    const tu = await prisma.tenant_user.create({
      data: { tenant_id: tenantId, user_id: BigInt(body.user_id) },
    })

    await prisma.model_has_roles.create({
      data: { role_id: role.id, model_type: MODEL_TYPE_TENANT_USER, model_id: tu.id },
    })

    logEvent('info', 'operator.attached', { managerId: payload.sub, tenantId: tenantId.toString(), userId: body.user_id })
    return Response.json({ tenant_user_id: tu.id.toString() }, { status: 201 })
  } catch (error) {
    return apiError(error)
  }
}
