import { requireJwt, apiError, requireApiEnabled } from '@/app/lib/api-auth'
import { getCategories } from '@/app/actions/posts'

export async function GET(request: Request) {
  try {
    await requireApiEnabled()
    requireJwt(request)
    const categories = await getCategories()
    return Response.json(categories)
  } catch (error) {
    return apiError(error)
  }
}
