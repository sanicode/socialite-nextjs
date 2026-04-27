import { requireJwt, apiError, ApiError, requireApiEnabled } from '@/app/lib/api-auth'
import { prisma } from '@/app/lib/prisma'
import { deleteFromS3 } from '@/app/lib/s3'
import { logEvent } from '@/app/lib/logger'

function getS3Key(media: { file_name: string; custom_properties: unknown }): string {
  const props = media.custom_properties as Record<string, unknown> | null
  if (props && typeof props.object_key === 'string') return props.object_key
  return media.file_name
}

export async function POST(request: Request) {
  try {
    await requireApiEnabled()
    const payload = requireJwt(request)

    if (!payload.roles.includes('admin')) {
      throw new ApiError(403, 'Hanya admin yang dapat menghapus laporan secara massal')
    }

    const body = await request.json()
    const { ids } = body

    if (!Array.isArray(ids) || ids.length === 0) {
      return Response.json({ error: 'ids harus berupa array yang tidak kosong' }, { status: 400 })
    }

    const bigIds = (ids as string[]).map((id) => BigInt(id))

    const mediaList = await prisma.media.findMany({
      where: { model_type: 'App\\Models\\BlogPost', model_id: { in: bigIds }, collection_name: 'blog-images' },
    })

    await Promise.allSettled(mediaList.map((m) => deleteFromS3(getS3Key(m))))
    if (mediaList.length > 0) {
      await prisma.media.deleteMany({ where: { id: { in: mediaList.map((m) => m.id) } } })
    }

    await prisma.blog_posts.deleteMany({ where: { id: { in: bigIds } } })

    logEvent('warn', 'mobile.posts.bulk_delete', { postIds: ids, userId: payload.sub, count: ids.length })
    return Response.json({ success: true, deleted: ids.length })
  } catch (error) {
    return apiError(error)
  }
}
