import { requireJwt, apiError, ApiError, requireApiEnabled } from '@/app/lib/api-auth'
import { getPostById } from '@/app/actions/posts'
import { prisma } from '@/app/lib/prisma'
import { deleteFromS3 } from '@/app/lib/s3'
import { logEvent } from '@/app/lib/logger'
import { canUserEditPost } from '@/app/lib/post-edit-access'

type Ctx = { params: Promise<{ id: string }> }

function getS3Key(media: { file_name: string; custom_properties: unknown }): string {
  const props = media.custom_properties as Record<string, unknown> | null
  if (props && typeof props.object_key === 'string') return props.object_key
  return media.file_name
}

// ── GET /api/mobile/posts/[id] ────────────────────────────────────────────────

export async function GET(request: Request, { params }: Ctx) {
  try {
    await requireApiEnabled()
    requireJwt(request)
    const { id } = await params
    const post = await getPostById(id)
    if (!post) return Response.json({ error: 'Laporan tidak ditemukan' }, { status: 404 })
    return Response.json(post)
  } catch (error) {
    return apiError(error)
  }
}

// ── PUT /api/mobile/posts/[id] ────────────────────────────────────────────────

const PLATFORM_PATTERNS: Record<string, { pattern: RegExp; label: string }> = {
  tiktok:    { pattern: /tiktok\.com/i,                       label: 'TikTok' },
  instagram: { pattern: /instagram\.com/i,                    label: 'Instagram' },
  facebook:  { pattern: /(facebook\.com|fb\.com|fb\.watch)/i, label: 'Facebook' },
  youtube:   { pattern: /(youtube\.com|youtu\.be)/i,          label: 'YouTube' },
}

function validateUrlForCategory(url: string, categoryName: string): string | null {
  const lower = categoryName.toLowerCase()
  for (const [key, { pattern, label }] of Object.entries(PLATFORM_PATTERNS)) {
    if (lower.includes(key)) {
      return pattern.test(url) ? null : `Link harus berupa URL ${label} yang valid.`
    }
  }
  return null
}

function generateSlug(title: string): string {
  const base = title.toLowerCase().trim()
    .replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80)
  return `${base}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

export async function PUT(request: Request, { params }: Ctx) {
  try {
    await requireApiEnabled()
    const payload = requireJwt(request)
    const { id } = await params

    // Manager-only cannot edit posts
    if (payload.roles.includes('manager') && !payload.roles.includes('admin')) {
      throw new ApiError(403, 'Manager tidak dapat mengedit laporan')
    }

    const post = await prisma.blog_posts.findUnique({
      where: { id: BigInt(id) },
      select: { id: true, user_id: true, tenant_id: true, source_url: true },
    })
    if (!post) return Response.json({ error: 'Laporan tidak ditemukan' }, { status: 404 })

    const canEdit = await canUserEditPost(
      { id: payload.sub, roles: payload.roles },
      {
        userId: post.user_id.toString(),
        tenantId: post.tenant_id?.toString() ?? null,
      }
    )
    if (!canEdit) {
      throw new ApiError(403, 'Anda tidak memiliki akses untuk mengedit laporan ini')
    }

    const body = await request.json()
    const {
      category_id,
      title,
      body: postBody,
      description,
      is_published,
      media_id,
      old_media_id,
    } = body

    const errors: Record<string, string> = {}
    const sourceUrl = post.source_url
    const requireTitle = sourceUrl !== 'amplifikasi'

    if (!category_id) errors.category_id = 'Kategori wajib dipilih.'
    if (requireTitle && !title) errors.title = 'Link upload tidak boleh kosong.'

    if (Object.keys(errors).length > 0) {
      return Response.json({ errors }, { status: 422 })
    }

    // Validasi URL per kategori
    if (requireTitle && title && category_id) {
      const cat = await prisma.blog_post_categories.findUnique({
        where: { id: BigInt(category_id) },
        select: { name: true },
      })
      if (cat) {
        const urlError = validateUrlForCategory(title, cat.name)
        if (urlError) return Response.json({ errors: { title: urlError } }, { status: 422 })
      }
    }

    const currentPost = await prisma.blog_posts.findUnique({
      where: { id: BigInt(id) },
      select: { is_published: true },
    })

    await prisma.blog_posts.update({
      where: { id: BigInt(id) },
      data: {
        title: title || '-',
        slug: generateSlug(title || 'laporan'),
        body: postBody || '-',
        description: description || null,
        is_published: Boolean(is_published),
        published_at:
          is_published && !currentPost?.is_published ? new Date() : is_published ? undefined : null,
        blog_post_category_id: category_id ? BigInt(category_id) : null,
        updated_at: new Date(),
      },
    })

    // Ganti media jika ada upload baru
    if (media_id) {
      if (old_media_id) {
        const oldMedia = await prisma.media.findUnique({ where: { id: BigInt(old_media_id) } })
        if (oldMedia) {
          await deleteFromS3(getS3Key(oldMedia)).catch(() => {})
          await prisma.media.delete({ where: { id: BigInt(old_media_id) } })
        }
      }
      await prisma.media.update({
        where: { id: BigInt(media_id) },
        data: { model_id: BigInt(id) },
      })
    }

    logEvent('info', 'mobile.posts.update', { postId: id, userId: payload.sub })
    return Response.json({ success: true })
  } catch (error) {
    return apiError(error)
  }
}

// ── DELETE /api/mobile/posts/[id] ─────────────────────────────────────────────

export async function DELETE(request: Request, { params }: Ctx) {
  try {
    await requireApiEnabled()
    const payload = requireJwt(request)
    const { id } = await params

    if (!payload.roles.includes('admin')) {
      throw new ApiError(403, 'Hanya admin yang dapat menghapus laporan')
    }

    const mediaList = await prisma.media.findMany({
      where: { model_type: 'App\\Models\\BlogPost', model_id: BigInt(id), collection_name: 'blog-images' },
    })

    await Promise.allSettled(mediaList.map((m) => deleteFromS3(getS3Key(m))))
    if (mediaList.length > 0) {
      await prisma.media.deleteMany({ where: { id: { in: mediaList.map((m) => m.id) } } })
    }

    await prisma.blog_posts.delete({ where: { id: BigInt(id) } })
    logEvent('warn', 'mobile.posts.delete', { postId: id, userId: payload.sub })

    return Response.json({ success: true })
  } catch (error) {
    return apiError(error)
  }
}
