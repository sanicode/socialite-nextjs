import { requireJwtRole, apiError, ApiError, requireApiEnabled } from '@/app/lib/api-auth'
import { prisma } from '@/app/lib/prisma'
import { getUserTenantIds } from '@/app/lib/tenant-access'

export async function GET(request: Request) {
  try {
    await requireApiEnabled()
    const payload = await requireJwtRole(request, 'admin', 'manager')
    const { searchParams } = new URL(request.url)

    const query = searchParams.get('q') ?? ''
    if (query.trim().length < 2) return Response.json([])

    const requestedTenantId = searchParams.get('tenantId')
    let tenantId: string
    if (payload.roles.includes('admin')) {
      if (!requestedTenantId) throw new ApiError(422, 'tenantId wajib diisi untuk admin.')
      tenantId = requestedTenantId
    } else {
      const tenantIds = await getUserTenantIds(payload.sub)
      if (tenantIds.length === 0) throw new ApiError(403, 'User tidak terdaftar di tenant manapun.')
      if (requestedTenantId && !tenantIds.includes(requestedTenantId)) throw new ApiError(403, 'Akses tenant ditolak.')
      if (!requestedTenantId && tenantIds.length > 1) throw new ApiError(422, 'tenantId wajib diisi untuk manager multi-tenant.')
      tenantId = requestedTenantId ?? tenantIds[0]
    }

    const rows = await prisma.$queryRawUnsafe<{ id: bigint; name: string; email: string }[]>(
      `SELECT u.id, u.name, u.email
       FROM users u
       WHERE (u.name ILIKE $1 OR u.email ILIKE $1)
         AND u.is_blocked = false
         AND u.id NOT IN (
           SELECT user_id FROM tenant_user WHERE tenant_id = $2
         )
       ORDER BY u.name ASC
       LIMIT 10`,
      `%${query.trim()}%`,
      BigInt(tenantId)
    )

    return Response.json(rows.map((r) => ({ id: r.id.toString(), name: r.name, email: r.email })))
  } catch (error) {
    return apiError(error)
  }
}
