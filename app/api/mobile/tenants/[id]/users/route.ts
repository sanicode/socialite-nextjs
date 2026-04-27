import { requireJwtRole, apiError, ApiError, requireApiEnabled } from '@/app/lib/api-auth'
import { prisma } from '@/app/lib/prisma'
import { logEvent } from '@/app/lib/logger'

const MODEL_TYPE_TENANT_USER = 'App\\Models\\TenantUser'
type Ctx = { params: Promise<{ id: string }> }

// ── GET /api/mobile/tenants/[id]/users ────────────────────────────────────────

export async function GET(request: Request, { params }: Ctx) {
  try {
    await requireApiEnabled()
    requireJwtRole(request, 'admin')
    const { id } = await params

    const rows = await prisma.$queryRawUnsafe<{
      tenant_user_id: bigint; user_id: bigint; name: string; email: string; role: string | null
    }[]>(
      `SELECT
         tu.id  AS tenant_user_id,
         u.id   AS user_id,
         u.name,
         u.email,
         (
           SELECT r.name FROM model_has_roles mhr
           JOIN roles r ON r.id = mhr.role_id
           WHERE mhr.model_type = 'App\\Models\\TenantUser' AND mhr.model_id = tu.id
           LIMIT 1
         ) AS role
       FROM tenant_user tu
       INNER JOIN users u ON u.id = tu.user_id
       WHERE tu.tenant_id = $1
       ORDER BY u.name ASC`,
      BigInt(id)
    )

    return Response.json(rows.map((r) => ({
      tenant_user_id: r.tenant_user_id.toString(),
      user_id: r.user_id.toString(),
      name: r.name,
      email: r.email,
      role: r.role,
    })))
  } catch (error) {
    return apiError(error)
  }
}

// ── POST /api/mobile/tenants/[id]/users ───────────────────────────────────────

export async function POST(request: Request, { params }: Ctx) {
  try {
    await requireApiEnabled()
    const admin = requireJwtRole(request, 'admin')
    const { id: tenantId } = await params
    const body = await request.json()

    const { user_id, role } = body
    if (!user_id) throw new ApiError(422, 'user_id wajib diisi.')
    if (role !== 'manager' && role !== 'operator') {
      throw new ApiError(422, 'role harus "manager" atau "operator".')
    }

    const existing = await prisma.tenant_user.findFirst({
      where: { tenant_id: BigInt(tenantId), user_id: BigInt(user_id) },
    })
    if (existing) throw new ApiError(409, 'User sudah terdaftar di tenant ini.')

    const roleRecord = await prisma.roles.findFirst({
      where: { name: role },
      orderBy: [{ is_tenant_role: 'desc' }, { id: 'asc' }],
    })
    if (!roleRecord) throw new ApiError(500, `Role '${role}' tidak ditemukan di database.`)

    const tu = await prisma.tenant_user.create({
      data: { tenant_id: BigInt(tenantId), user_id: BigInt(user_id) },
    })

    await prisma.model_has_roles.create({
      data: { role_id: roleRecord.id, model_type: MODEL_TYPE_TENANT_USER, model_id: tu.id },
    })

    logEvent('info', 'tenant.user_attached', { adminId: admin.sub, tenantId, userId: user_id, role })
    return Response.json({ tenant_user_id: tu.id.toString() }, { status: 201 })
  } catch (error) {
    return apiError(error)
  }
}
