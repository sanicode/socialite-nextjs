import { requireJwt, apiError, requireApiEnabled } from '@/app/lib/api-auth'
import { prisma } from '@/app/lib/prisma'

export async function GET(request: Request) {
  try {
    await requireApiEnabled()
    await requireJwt(request)
    const categories = await prisma.blog_post_categories.findMany({ orderBy: { name: 'asc' } })
    return Response.json(categories.map((category) => ({ id: category.id.toString(), name: category.name })))
  } catch (error) {
    return apiError(error)
  }
}
