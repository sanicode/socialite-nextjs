import { requireJwtRole, apiError, ApiError, requireApiEnabled } from '@/app/lib/api-auth'
import { prisma } from '@/app/lib/prisma'
import { logEvent } from '@/app/lib/logger'
import { canActorAccessTenant } from '@/app/lib/tenant-access'

const MODEL_TYPE_TENANT_USER = 'App\\Models\\TenantUser'
type Ctx = { params: Promise<{ tenantUserId: string }> }

export async function DELETE(request: Request, { params }: Ctx) {
  try {
    await requireApiEnabled()
    const payload = await requireJwtRole(request, 'admin', 'manager')
    const { tenantUserId } = await params
    const target = await prisma.tenant_user.findUnique({
      where: { id: BigInt(tenantUserId) },
      select: { tenant_id: true },
    })
    if (!target) throw new ApiError(404, 'Operator tidak ditemukan')
    const canAccessTenant = await canActorAccessTenant(payload, target.tenant_id.toString())
    if (!canAccessTenant) throw new ApiError(403, 'Akses ditolak')

    await prisma.model_has_roles.deleteMany({
      where: { model_type: MODEL_TYPE_TENANT_USER, model_id: BigInt(tenantUserId) },
    })
    await prisma.tenant_user.delete({ where: { id: BigInt(tenantUserId) } })

    logEvent('warn', 'operator.detached', { managerId: payload.sub, tenantUserId })
    return Response.json({ success: true })
  } catch (error) {
    return apiError(error)
  }
}
