import { requireJwt, apiError, requireApiEnabled } from '@/app/lib/api-auth'
import { prisma } from '@/app/lib/prisma'
import { normalizeSocialUrlRules } from '@/app/lib/social-platform'

export async function GET(request: Request) {
  try {
    await requireApiEnabled()
    await requireJwt(request)
    const categories = await prisma.blog_post_categories.findMany({
      where: { is_active: true, deleted_at: null },
      orderBy: { name: 'asc' },
    })
    return Response.json(categories.map((category) => ({
      id: category.id.toString(),
      name: category.name,
      is_required: category.is_required,
      url_rules: normalizeSocialUrlRules(category.url_rules),
    })))
  } catch (error) {
    return apiError(error)
  }
}
