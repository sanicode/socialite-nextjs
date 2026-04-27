import { requireJwt, apiError, requireApiEnabled } from '@/app/lib/api-auth'
import { getCities } from '@/app/actions/dashboard'

export async function GET(request: Request) {
  try {
    await requireApiEnabled()
    requireJwt(request)
    const { searchParams } = new URL(request.url)
    const provinceId = searchParams.get('provinceId') ?? undefined
    const cities = await getCities(provinceId)
    return Response.json(cities)
  } catch (error) {
    return apiError(error)
  }
}
