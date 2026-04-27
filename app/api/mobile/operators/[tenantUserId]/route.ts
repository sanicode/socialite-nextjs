import { requireJwtRole, apiError, requireApiEnabled } from '@/app/lib/api-auth'
import { prisma } from '@/app/lib/prisma'
import { logEvent } from '@/app/lib/logger'

const MODEL_TYPE_TENANT_USER = 'App\\Models\\TenantUser'
type Ctx = { params: Promise<{ tenantUserId: string }> }

export async function DELETE(request: Request, { params }: Ctx) {
  try {
    await requireApiEnabled()
    const payload = requireJwtRole(request, 'admin', 'manager')
    const { tenantUserId } = await params

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
