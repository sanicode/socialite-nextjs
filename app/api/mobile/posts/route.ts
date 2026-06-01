import { requireJwt, apiError, ApiError, requireApiEnabled } from '@/app/lib/api-auth'
import { prisma } from '@/app/lib/prisma'
import { logEvent } from '@/app/lib/logger'
import type { JwtPayload } from '@/app/lib/jwt'
import { getSocialLinkMetadata } from '@/app/lib/link-metadata'
import { parseLinkPreviewDescription, stringifyLinkPreviewDescription } from '@/app/lib/link-preview-description'
import { getOperatorReportingWindowDecision } from '@/app/lib/operator-reporting-window'
import { getUserTenantIds } from '@/app/lib/tenant-access'
import { queryPosts } from '@/app/lib/posts-query'
import { normalizeSocialUrl, validateSocialUrlForCategory } from '@/app/lib/social-platform'
import { DUPLICATE_UPLOAD_LINK_MESSAGE, findDuplicateUploadLink } from '@/app/lib/upload-link-duplicates'
import {
  OperatorReportDailyLimitError,
  withOperatorReportDailyLimit,
} from '@/app/lib/operator-report-daily-limit'

// ── helpers ──────────────────────────────────────────────────────────────────

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
    const payload = await requireJwt(request)
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

    const userId = isOperatorJwt(payload) ? payload.sub : (searchParams.get('userId') ?? undefined)
    let tenantId = payload.roles.includes('admin') ? (searchParams.get('tenantId') ?? undefined) : undefined
    let tenantIds: string[] | undefined

    if (payload.roles.includes('manager') && !payload.roles.includes('admin')) {
      const managerTenantIds = await getUserTenantIds(payload.sub)
      if (managerTenantIds.length === 0) throw new ApiError(403, 'Akses tenant tidak ditemukan')
      const requestedTenantId = searchParams.get('tenantId')
      if (requestedTenantId && !managerTenantIds.includes(requestedTenantId)) {
        throw new ApiError(403, 'Akses tenant ditolak')
      }
      tenantIds = requestedTenantId ? [requestedTenantId] : managerTenantIds
      tenantId = undefined
    }

    const result = await queryPosts({ search, categoryId, status, page, userId, tenantId, tenantIds, dateFrom, dateTo, sortOrder, postType })
    return Response.json(result)
  } catch (error) {
    return apiError(error)
  }
}

// ── POST — create post ────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    await requireApiEnabled()
    const payload = await requireJwt(request)

    // Manager-only cannot create posts
    if (payload.roles.includes('manager') && !payload.roles.includes('admin')) {
      throw new ApiError(403, 'Manager tidak dapat membuat laporan')
    }

    const reportingWindowDecision = await getOperatorReportingWindowDecision(payload.roles)
    if (!reportingWindowDecision.allowed) {
      throw new ApiError(403, reportingWindowDecision.message ?? 'Pelaporan operator sedang ditutup.')
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

    const categoryId = typeof category_id === 'string' || typeof category_id === 'number'
      ? String(category_id)
      : ''

    if (!categoryId) {
      errors.category_id = 'Kategori wajib dipilih.'
    } else if (!/^\d+$/.test(categoryId)) {
      errors.category_id = 'Kategori tidak valid.'
    }

    const requireTitle  = post_type !== 'amplifikasi'
    const requireMedia  = post_type === 'amplifikasi' || post_type === undefined
    const sourceUrl: string | null = post_type === 'upload' ? 'upload' : post_type === 'amplifikasi' ? 'amplifikasi' : null
    const rawTitle = typeof title === 'string' ? title.trim() : ''

    if (requireTitle && !rawTitle) errors.title = 'Link upload tidak boleh kosong.'
    if (requireMedia && !media_id) errors.media_id = 'Screenshot wajib diupload terlebih dahulu.'

    if (Object.keys(errors).length > 0) {
      return Response.json({ errors }, { status: 422 })
    }

    // ── validasi URL per kategori ──
    const selectedCategory = await prisma.blog_post_categories.findFirst({
      where: {
        id: BigInt(categoryId),
        is_active: true,
        deleted_at: null,
      },
      select: { name: true, url_rules: true },
    })
    if (!selectedCategory) {
      return Response.json({ errors: { category_id: 'Kategori medsos tidak aktif atau tidak ditemukan.' } }, { status: 422 })
    }

    let categoryForRules: { name: string; url_rules: unknown | null } | null = null
    if (requireTitle && rawTitle) {
      categoryForRules = selectedCategory
      const urlError = validateSocialUrlForCategory(rawTitle, selectedCategory)
      if (urlError) return Response.json({ errors: { title: urlError } }, { status: 422 })
    }

    if (sourceUrl === 'upload' && rawTitle) {
      const duplicate = await findDuplicateUploadLink(rawTitle)
      if (duplicate) {
        return Response.json({ errors: { title: DUPLICATE_UPLOAD_LINK_MESSAGE }, duplicate: true }, { status: 409 })
      }
    }

    if (sourceUrl !== 'amplifikasi') {
      const userId = BigInt(payload.sub)
      const now = new Date()
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0)
      const endOfDay   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
      const existing = await prisma.blog_posts.findFirst({
        where: {
          user_id: userId,
          blog_post_category_id: BigInt(categoryId),
          source_url: sourceUrl,
          created_at: { gte: startOfDay, lte: endOfDay },
        },
        select: { id: true },
      })
      if (existing) {
        return Response.json({
          error: `Double entry terdeteksi! Anda sudah mengirim laporan kategori "${selectedCategory.name}" hari ini.`,
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
    const storedTitle = sourceUrl === 'upload' && rawTitle ? normalizeSocialUrl(rawTitle) : (rawTitle || '-')
    const metadata = sourceUrl === 'upload' && rawTitle && categoryForRules
      ? await getSocialLinkMetadata(rawTitle, categoryForRules)
      : null
    const inputDescription = typeof description === 'string' && description.trim() ? description.trim() : null
    const storedDescription = sourceUrl === 'upload'
      ? (
          stringifyLinkPreviewDescription({
            text: metadata?.description,
            thumbnailUrl: metadata?.thumbnailUrl,
          }) ?? stringifyLinkPreviewDescription({ text: parseLinkPreviewDescription(inputDescription).text })
        )
      : inputDescription

    const postData = {
      title: storedTitle,
      slug: generateSlug(storedTitle || 'laporan'),
      body: postBody || '-',
      description: storedDescription,
      status: 'pending',
      is_published: Boolean(is_published),
      published_at: is_published ? new Date() : null,
      user_id: userId,
      tenant_id: tenantUser?.tenant_id ?? null,
      blog_post_category_id: BigInt(categoryId),
      source_url: sourceUrl,
      created_at: new Date(),
    }
    let post
    try {
      post = sourceUrl === 'upload' || sourceUrl === 'amplifikasi'
        ? await withOperatorReportDailyLimit(userId, sourceUrl, (tx) => tx.blog_posts.create({ data: postData }))
        : await prisma.blog_posts.create({ data: postData })
    } catch (error) {
      if (error instanceof OperatorReportDailyLimitError) {
        return Response.json({ error: error.message }, { status: 422 })
      }
      throw error
    }

    // ── link media ──
    if (media_id) {
      const media = await prisma.media.findUnique({
        where: { id: BigInt(media_id) },
        select: { id: true, model_id: true, collection_name: true, custom_properties: true },
      })
      const props = media?.custom_properties as Record<string, unknown> | null
      if (
        !media ||
        media.collection_name !== 'blog-images' ||
        media.model_id !== BigInt(0) ||
        props?.uploaded_by !== payload.sub
      ) {
        throw new ApiError(403, 'Media upload tidak valid')
      }
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
