import { requireJwtRole, apiError, requireApiEnabled } from '@/app/lib/api-auth'
import { prisma } from '@/app/lib/prisma'
import { logEvent } from '@/app/lib/logger'

const MODEL_TYPE_TENANT_USER = 'App\\Models\\TenantUser'
type Ctx = { params: Promise<{ id: string; tenantUserId: string }> }

export async function DELETE(request: Request, { params }: Ctx) {
  try {
    await requireApiEnabled()
    const admin = await requireJwtRole(request, 'admin')
    const { tenantUserId } = await params

    await prisma.model_has_roles.deleteMany({
      where: { model_type: MODEL_TYPE_TENANT_USER, model_id: BigInt(tenantUserId) },
    })
    await prisma.tenant_user.delete({ where: { id: BigInt(tenantUserId) } })

    logEvent('warn', 'tenant.user_detached', { adminId: admin.sub, tenantUserId })
    return Response.json({ success: true })
  } catch (error) {
    return apiError(error)
  }
}
