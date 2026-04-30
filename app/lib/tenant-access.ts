import { prisma } from '@/app/lib/prisma'

export type Actor = { id: string; roles: string[] } | { sub: string; roles: string[] }

export type PostAccessSubject = {
  userId: string | null
  tenantId: string | null
}

export function actorId(actor: Actor): string {
  return 'sub' in actor ? actor.sub : actor.id
}

export function isAdminActor(actor: Actor): boolean {
  return actor.roles.includes('admin')
}

export function isManagerActor(actor: Actor): boolean {
  return actor.roles.includes('manager')
}

export async function getUserTenantIds(userId: string): Promise<string[]> {
  const rows = await prisma.tenant_user.findMany({
    where: { user_id: BigInt(userId) },
    select: { tenant_id: true },
    orderBy: [{ is_default: 'desc' }, { id: 'asc' }],
  })
  return [...new Set(rows.map((row) => row.tenant_id.toString()))]
}

export async function resolveTenantScopeForActor(
  actor: Actor,
  requestedTenantId?: string | null,
): Promise<string | null> {
  if (isAdminActor(actor)) return requestedTenantId ?? null
  if (!isManagerActor(actor)) return null

  const tenantIds = await getUserTenantIds(actorId(actor))
  if (tenantIds.length === 0) return null
  if (!requestedTenantId) return tenantIds[0]
  return tenantIds.includes(requestedTenantId) ? requestedTenantId : null
}

export async function canActorAccessTenant(actor: Actor, tenantId: string | null | undefined): Promise<boolean> {
  if (isAdminActor(actor)) return true
  if (!tenantId) return false
  const tenantIds = await getUserTenantIds(actorId(actor))
  return tenantIds.includes(tenantId)
}

export async function isOperatorInTenant(userId: string, tenantId: string): Promise<boolean> {
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

export async function canActorReadPost(actor: Actor, subject: PostAccessSubject | null | undefined): Promise<boolean> {
  if (!subject) return false
  if (isAdminActor(actor)) return true
  if (isManagerActor(actor)) return canActorAccessTenant(actor, subject.tenantId)
  return subject.userId === actorId(actor)
}

export async function canActorEditPost(actor: Actor, subject: PostAccessSubject | null | undefined): Promise<boolean> {
  if (!subject) return false
  if (isAdminActor(actor)) return true

  if (isManagerActor(actor)) {
    if (!subject.userId || !subject.tenantId) return false
    const canAccessTenant = await canActorAccessTenant(actor, subject.tenantId)
    if (!canAccessTenant) return false
    return isOperatorInTenant(subject.userId, subject.tenantId)
  }

  return subject.userId === actorId(actor)
}

export const canActorValidatePost = canActorEditPost
