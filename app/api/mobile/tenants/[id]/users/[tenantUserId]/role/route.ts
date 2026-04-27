import { requireJwtRole, apiError, ApiError, requireApiEnabled } from '@/app/lib/api-auth'
import { prisma } from '@/app/lib/prisma'
import { logEvent } from '@/app/lib/logger'

const MODEL_TYPE_TENANT_USER = 'App\\Models\\TenantUser'
type Ctx = { params: Promise<{ id: string; tenantUserId: string }> }

export async function PATCH(request: Request, { params }: Ctx) {
  try {
    await requireApiEnabled()
    const admin = requireJwtRole(request, 'admin')
    const { tenantUserId } = await params
    const body = await request.json()

    const { role } = body
    if (role !== 'manager' && role !== 'operator') {
      throw new ApiError(422, 'role harus "manager" atau "operator".')
    }

    const roleRecord = await prisma.roles.findFirst({
      where: { name: role },
      orderBy: [{ is_tenant_role: 'desc' }, { id: 'asc' }],
    })
    if (!roleRecord) throw new ApiError(500, `Role '${role}' tidak ditemukan di database.`)

    await prisma.model_has_roles.deleteMany({
      where: { model_type: MODEL_TYPE_TENANT_USER, model_id: BigInt(tenantUserId) },
    })
    await prisma.model_has_roles.create({
      data: { role_id: roleRecord.id, model_type: MODEL_TYPE_TENANT_USER, model_id: BigInt(tenantUserId) },
    })

    logEvent('info', 'tenant.user_role_updated', { adminId: admin.sub, tenantUserId, role })
    return Response.json({ success: true })
  } catch (error) {
    return apiError(error)
  }
}
