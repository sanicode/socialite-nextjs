import { requireJwt, apiError, ApiError, requireApiEnabled } from '@/app/lib/api-auth'
import { getPosts } from '@/app/actions/posts'
import { prisma } from '@/app/lib/prisma'
import { logEvent } from '@/app/lib/logger'
import type { JwtPayload } from '@/app/lib/jwt'

// ── helpers ──────────────────────────────────────────────────────────────────

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
  const base = title
    .toLowerCase().trim()
    .replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '')
    .slice(0, 80)
  return `${base}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function isOperatorJwt(payload: JwtPayload) {
  return !payload.roles.includes('admin') && !payload.roles.includes('manager')
}

// ── GET — list posts ──────────────────────────────────────────────────────────

export async function GET(request: Request) {
  try {
    await requireApiEnabled()
    const payload = requireJwt(request)
    const { searchParams } = new URL(request.url)

    const page       = Number(searchParams.get('page') ?? '1')
    const search     = searchParams.get('search') ?? undefined
    const categoryId = searchParams.get('categoryId') ?? undefined
    const statusParam = searchParams.get('status')
    const status     = statusParam === 'pending' || statusParam === 'valid' || statusParam === 'invalid'
      ? statusParam
      : undefined
    const dateFrom   = searchParams.get('dateFrom') ?? undefined
    const dateTo     = searchParams.get('dateTo') ?? undefined
    const sortOrder  = searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc'
    const ptParam    = searchParams.get('postType')
    const postType   = ptParam === 'upload' || ptParam === 'amplifikasi' ? ptParam : undefined

    const userId   = isOperatorJwt(payload) ? payload.sub : (searchParams.get('userId') ?? undefined)
    const tenantId = searchParams.get('tenantId') ?? undefined

    const result = await getPosts({ search, categoryId, status, page, userId, tenantId, dateFrom, dateTo, sortOrder, postType })
    return Response.json(result)
  } catch (error) {
    return apiError(error)
  }
}

// ── POST — create post ────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    await requireApiEnabled()
    const payload = requireJwt(request)

    // Manager-only cannot create posts
    if (payload.roles.includes('manager') && !payload.roles.includes('admin')) {
      throw new ApiError(403, 'Manager tidak dapat membuat laporan')
    }

    const body = await request.json()
    const {
      category_id,
      title,       // link upload (untuk upload & default)
      body: postBody,
      description,
      is_published = false,
      media_id,    // ID media yang sudah diupload via /api/mobile/upload
      post_type,   // 'upload' | 'amplifikasi' | undefined (default)
    } = body

    // ── validasi ──
    const errors: Record<string, string> = {}

    if (!category_id) errors.category_id = 'Kategori wajib dipilih.'

    const requireTitle  = post_type !== 'amplifikasi'
    const requireMedia  = post_type === 'amplifikasi' || post_type === undefined
    const sourceUrl: string | null = post_type === 'upload' ? 'upload' : post_type === 'amplifikasi' ? 'amplifikasi' : null

    if (requireTitle && !title) errors.title = 'Link upload tidak boleh kosong.'
    if (requireMedia && !media_id) errors.media_id = 'Screenshot wajib diupload terlebih dahulu.'

    if (Object.keys(errors).length > 0) {
      return Response.json({ errors }, { status: 422 })
    }

    // ── validasi URL per kategori ──
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

    // ── cek duplicate: amplifikasi boleh lebih dari satu per kategori per hari ──
    if (category_id && sourceUrl !== 'amplifikasi') {
      const userId = BigInt(payload.sub)
      const now = new Date()
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0)
      const endOfDay   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
      const existing = await prisma.blog_posts.findFirst({
        where: {
          user_id: userId,
          blog_post_category_id: BigInt(category_id),
          source_url: sourceUrl,
          created_at: { gte: startOfDay, lte: endOfDay },
        },
        select: { id: true },
      })
      if (existing) {
        const cat = await prisma.blog_post_categories.findUnique({
          where: { id: BigInt(category_id) },
          select: { name: true },
        })
        return Response.json({
          error: `Double entry terdeteksi! Anda sudah mengirim laporan kategori "${cat?.name ?? 'ini'}" hari ini.`,
          duplicate: true,
        }, { status: 409 })
      }
    }

    // ── buat post ──
    const userId = BigInt(payload.sub)
    const tenantUser = await prisma.tenant_user.findFirst({
      where: { user_id: userId },
      select: { tenant_id: true },
    })

    const post = await prisma.blog_posts.create({
      data: {
        title: title || '-',
        slug: generateSlug(title || 'laporan'),
        body: postBody || '-',
        description: description || null,
        status: 'pending',
        is_published: Boolean(is_published),
        published_at: is_published ? new Date() : null,
        user_id: userId,
        tenant_id: tenantUser?.tenant_id ?? null,
        blog_post_category_id: category_id ? BigInt(category_id) : null,
        source_url: sourceUrl,
        created_at: new Date(),
      },
    })

    // ── link media ──
    if (media_id) {
      await prisma.media.update({
        where: { id: BigInt(media_id) },
        data: { model_id: post.id },
      })
    }

    logEvent('info', 'mobile.posts.create', { postId: post.id.toString(), userId: payload.sub })

    return Response.json({ id: post.id.toString() }, { status: 201 })
  } catch (error) {
    return apiError(error)
  }
}
