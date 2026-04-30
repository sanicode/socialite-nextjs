import { requireJwt, apiError, requireApiEnabled } from '@/app/lib/api-auth'
import { prisma } from '@/app/lib/prisma'

export async function GET(request: Request) {
  try {
    await requireApiEnabled()
    await requireJwt(request)
    const provinces = await prisma.reg_provinces.findMany({ orderBy: { name: 'asc' } })
    return Response.json(provinces)
  } catch (error) {
    return apiError(error)
  }
}
