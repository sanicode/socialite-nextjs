import { requireJwt, apiError, ApiError, requireApiEnabled } from '@/app/lib/api-auth'
import { prisma } from '@/app/lib/prisma'
import { logEvent } from '@/app/lib/logger'

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, { params }: Ctx) {
  try {
    await requireApiEnabled()
    const payload = requireJwt(request)
    const { id } = await params

    if (!payload.roles.includes('admin') && !payload.roles.includes('manager')) {
      throw new ApiError(403, 'Hanya admin atau manager yang dapat mengubah status laporan')
    }

    const body = await request.json()
    const { status } = body

    if (!['pending', 'valid', 'invalid'].includes(status)) {
      return Response.json({ error: 'Status harus pending, valid, atau invalid' }, { status: 400 })
    }

    const post = await prisma.blog_posts.findUnique({
      where: { id: BigInt(id) },
      select: { id: true },
    })
    if (!post) return Response.json({ error: 'Laporan tidak ditemukan' }, { status: 404 })

    await prisma.blog_posts.update({
      where: { id: BigInt(id) },
      data: { status, updated_at: new Date() },
    })

    logEvent('info', 'mobile.posts.update_status', { postId: id, userId: payload.sub, status })
    return Response.json({ success: true })
  } catch (error) {
    return apiError(error)
  }
}
