import { requireJwt, apiError, requireApiEnabled } from '@/app/lib/api-auth'
import { getProvinces } from '@/app/actions/dashboard'

export async function GET(request: Request) {
  try {
    await requireApiEnabled()
    requireJwt(request)
    const provinces = await getProvinces()
    return Response.json(provinces)
  } catch (error) {
    return apiError(error)
  }
}
