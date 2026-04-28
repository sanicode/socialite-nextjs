import { prisma } from '@/app/lib/prisma'
import type { SessionUser } from '@/app/lib/session'

export type PostEditSubject = {
  userId: string | null
  tenantId: string | null
}

async function getManagerTenantId(userId: string): Promise<string | null> {
  const tenantUser = await prisma.tenant_user.findFirst({
    where: { user_id: BigInt(userId) },
    select: { tenant_id: true },
  })
  return tenantUser?.tenant_id?.toString() ?? null
}

async function isOperatorInTenant(userId: string, tenantId: string): Promise<boolean> {
  const tenantUser = await prisma.tenant_user.findFirst({
    where: {
      user_id: BigInt(userId),
      tenant_id: BigInt(tenantId),
    },
    select: { id: true },
  })
  if (!tenantUser) return false

  const roles = await prisma.model_has_roles.findMany({
    where: {
      model_type: 'App\\Models\\TenantUser',
      model_id: tenantUser.id,
    },
    include: { roles: true },
  })

  return roles.some((entry) => entry.roles.name === 'operator')
}

export async function canUserEditPost(
  user: Pick<SessionUser, 'id' | 'roles'>,
  subject: PostEditSubject | null | undefined,
): Promise<boolean> {
  if (!subject) return false

  if (user.roles.includes('admin')) return true

  if (user.roles.includes('manager')) {
    const managerTenantId = await getManagerTenantId(user.id)
    if (!managerTenantId || managerTenantId !== subject.tenantId) return false
    if (!subject.userId) return false

    return isOperatorInTenant(subject.userId, subject.tenantId)
  }

  return subject.userId === user.id
}
