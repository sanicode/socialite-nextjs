import { requireJwtRole, apiError, requireApiEnabled } from '@/app/lib/api-auth'
import { prisma } from '@/app/lib/prisma'

export async function GET(request: Request) {
  try {
    await requireApiEnabled()
    requireJwtRole(request, 'admin')
    const roles = await prisma.roles.findMany({
      where: { tenant_id: null },
      orderBy: { name: 'asc' },
    })
    return Response.json(roles.map((r) => ({ id: r.id.toString(), name: r.name })))
  } catch (error) {
    return apiError(error)
  }
}
