import { prisma } from '@/app/lib/prisma'

const MODEL_TYPE_USER = 'App\\Models\\User'
const MODEL_TYPE_TENANT_USER = 'App\\Models\\TenantUser'

export async function getUserRoles(userId: string): Promise<string[]> {
  const bigId = BigInt(userId)

  // Roles assigned directly to the User model (e.g. admin)
  const userEntries = await prisma.model_has_roles.findMany({
    where: {
      model_type: MODEL_TYPE_USER,
      model_id: bigId,
    },
    include: { roles: true },
  })

  // Roles assigned via TenantUser model (e.g. manager, operator)
  const tenantUserRecords = await prisma.tenant_user.findMany({
    where: { user_id: bigId },
    select: { id: true },
  })
  const tenantUserIds = tenantUserRecords.map((tu) => tu.id)

  const tenantUserEntries = tenantUserIds.length
    ? await prisma.model_has_roles.findMany({
        where: {
          model_type: MODEL_TYPE_TENANT_USER,
          model_id: { in: tenantUserIds },
        },
        include: { roles: true },
      })
    : []

  const allRoles = new Set([
    ...userEntries.map((e) => e.roles.name),
    ...tenantUserEntries.map((e) => e.roles.name),
  ])

  return Array.from(allRoles)
}

export async function hasRole(userId: string, role: string): Promise<boolean> {
  const roles = await getUserRoles(userId)
  return roles.includes(role)
}

export async function hasAnyRole(userId: string, roles: string[]): Promise<boolean> {
  const userRoles = await getUserRoles(userId)
  return roles.some((r) => userRoles.includes(r))
}

export async function getUserPermissions(userId: string): Promise<string[]> {
  const bigId = BigInt(userId)

  // Direct permissions on User model
  const directPerms = await prisma.model_has_permissions.findMany({
    where: {
      model_type: MODEL_TYPE_USER,
      model_id: bigId,
    },
    include: { permissions: true },
  })

  // Roles on User model
  const userRoleEntries = await prisma.model_has_roles.findMany({
    where: {
      model_type: MODEL_TYPE_USER,
      model_id: bigId,
    },
    select: { role_id: true },
  })

  // Roles on TenantUser model
  const tenantUserRecords = await prisma.tenant_user.findMany({
    where: { user_id: bigId },
    select: { id: true },
  })
  const tenantUserIds = tenantUserRecords.map((tu) => tu.id)

  const tenantUserRoleEntries = tenantUserIds.length
    ? await prisma.model_has_roles.findMany({
        where: {
          model_type: MODEL_TYPE_TENANT_USER,
          model_id: { in: tenantUserIds },
        },
        select: { role_id: true },
      })
    : []

  const roleIds = [
    ...userRoleEntries.map((r) => r.role_id),
    ...tenantUserRoleEntries.map((r) => r.role_id),
  ]

  const rolePerms = roleIds.length
    ? await prisma.role_has_permissions.findMany({
        where: { role_id: { in: roleIds } },
        include: { permissions: true },
      })
    : []

  const allNames = new Set([
    ...directPerms.map((p) => p.permissions.name),
    ...rolePerms.map((p) => p.permissions.name),
  ])

  return Array.from(allNames)
}

export async function hasPermission(userId: string, permission: string): Promise<boolean> {
  const perms = await getUserPermissions(userId)
  return perms.includes(permission)
}
