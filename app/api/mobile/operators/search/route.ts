import { requireJwtRole, apiError, ApiError, requireApiEnabled } from '@/app/lib/api-auth'
import { prisma } from '@/app/lib/prisma'

export async function GET(request: Request) {
  try {
    await requireApiEnabled()
    const payload = requireJwtRole(request, 'admin', 'manager')
    const { searchParams } = new URL(request.url)

    const query = searchParams.get('q') ?? ''
    if (query.trim().length < 2) return Response.json([])

    const tu = await prisma.tenant_user.findFirst({
      where: { user_id: BigInt(payload.sub) },
      select: { tenant_id: true },
    })
    if (!tu) throw new ApiError(403, 'User tidak terdaftar di tenant manapun.')

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
      tu.tenant_id
    )

    return Response.json(rows.map((r) => ({ id: r.id.toString(), name: r.name, email: r.email })))
  } catch (error) {
    return apiError(error)
  }
}
