import { requireJwtRole, apiError, ApiError, requireApiEnabled } from '@/app/lib/api-auth'
import { prisma } from '@/app/lib/prisma'

export async function GET(request: Request) {
  try {
    await requireApiEnabled()
    requireJwtRole(request, 'admin')
    const { searchParams } = new URL(request.url)

    const query    = searchParams.get('q') ?? ''
    const tenantId = searchParams.get('tenantId') ?? ''

    if (!tenantId) throw new ApiError(400, 'tenantId wajib diisi.')
    if (query.trim().length < 2) return Response.json([])

    const rows = await prisma.$queryRawUnsafe<{ id: bigint; name: string; email: string }[]>(
      `SELECT u.id, u.name, u.email
       FROM users u
       WHERE (u.name ILIKE $1 OR u.email ILIKE $1)
         AND u.is_blocked = false
         AND u.id NOT IN (
           SELECT user_id FROM tenant_user WHERE tenant_id = $2
         )
         AND NOT EXISTS (
           SELECT 1
           FROM model_has_roles mhr
           JOIN tenant_user tu ON tu.id = mhr.model_id
           WHERE mhr.model_type = 'App\\Models\\TenantUser'
             AND tu.user_id = u.id
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
