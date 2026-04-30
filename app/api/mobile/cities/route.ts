import { requireJwt, apiError, requireApiEnabled } from '@/app/lib/api-auth'
import { prisma } from '@/app/lib/prisma'

export async function GET(request: Request) {
  try {
    await requireApiEnabled()
    await requireJwt(request)
    const { searchParams } = new URL(request.url)
    const provinceId = searchParams.get('provinceId') ?? undefined
    const where = provinceId ? { province_id: parseInt(provinceId, 10) } : {}
    const cities = await prisma.reg_cities.findMany({ where, orderBy: { name: 'asc' } })
    return Response.json(cities.map((city) => ({ id: city.id.toString(), name: city.name })))
  } catch (error) {
    return apiError(error)
  }
}
