'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { cache } from 'react'
import { prisma } from '@/app/lib/prisma'
import { deleteFromS3, getMediaUrl } from '@/app/lib/s3'
import { assertAdmin, assertNotManagerOnly, requireManagerOrAdmin, requireUser } from '@/app/lib/authorization'
import { logEvent } from '@/app/lib/logger'
import { canUserEditPost } from '@/app/lib/post-edit-access'
import { getSecuritySettings } from '@/app/lib/request-security'
import { appendSuccessParam, getPathname, normalizeReturnTo } from '@/app/lib/return-to'
import { formatUploadFileSize } from '@/app/lib/upload-size'
import { AMPLIFIKASI_DAILY_LIMIT, countUserAmplifikasiToday } from '@/app/lib/amplifikasi-limit'
import { deleteSession } from '@/app/lib/session'
import type { TablePageSize } from '@/app/lib/table-pagination'
import { canActorReadPost, canActorValidatePost, getUserTenantIds } from '@/app/lib/tenant-access'
import { detectAllowedImage } from '@/app/lib/file-validation'
import { queryPostById, queryPosts } from '@/app/lib/posts-query'
import { getReportLocationByTenantId, type ReportObjectLocation } from '@/app/lib/report-location'
import {
  getNonAdminReportingWindowDecision,
  getOperatorReportingWindowDecision,
} from '@/app/lib/operator-reporting-window'

async function redirectToLoginIfUnauthorized(error: unknown): Promise<never> {
  if (error instanceof Error && error.message === 'Unauthorized') {
    await deleteSession()
    redirect('/login')
  }
  throw error
}

export async function updatePostStatus(postId: string, status: 'pending' | 'valid' | 'invalid') {
  const sessionUser = await requireManagerOrAdmin().catch(redirectToLoginIfUnauthorized)
  const reportingWindowDecision = await getNonAdminReportingWindowDecision(sessionUser.roles)
  if (!reportingWindowDecision.allowed) {
    throw new Error(reportingWindowDecision.message ?? 'Pelaporan sedang ditutup.')
  }
  if (!sessionUser.roles.includes('admin') && status !== 'pending') {
    throw new Error('Validasi manager dilakukan dari halaman View operator.')
  }
  try {
    const post = await prisma.blog_posts.findUnique({
      where: { id: BigInt(postId) },
      select: { user_id: true, tenant_id: true },
    })
    if (!post) throw new Error('Laporan tidak ditemukan')
    const canValidate = await canActorValidatePost(sessionUser, {
      userId: post.user_id.toString(),
      tenantId: post.tenant_id?.toString() ?? null,
    })
    if (!canValidate) throw new Error('Anda tidak memiliki akses untuk mengubah status laporan ini')

    await prisma.blog_posts.update({
      where: { id: BigInt(postId) },
      data: { status },
    })
    
    // Opsional: Revalidate agar data di server terupdate
    revalidatePath('/posts/users/[userId]/[status]', 'page')
    
    //return { success: true }
    return {
      message: `Status post berhasil diupdate.`,
      success: 'updated',
    }
  } catch (error) {
    console.error(error)
    throw new Error("Failed to update status")
  }
}

export async function updateOperatorPostStatus(
  postId: string,
  status: 'pending' | 'valid' | 'invalid',
  dateFrom: string,
  dateTo: string,
) {
  const sessionUser = await requireManagerOrAdmin().catch(redirectToLoginIfUnauthorized)
  const reportingWindowDecision = await getNonAdminReportingWindowDecision(sessionUser.roles)
  if (!reportingWindowDecision.allowed) {
    throw new Error(reportingWindowDecision.message ?? 'Pelaporan sedang ditutup.')
  }

  const post = await prisma.blog_posts.findUnique({
    where: { id: BigInt(postId) },
    select: { user_id: true, tenant_id: true },
  })
  if (!post) throw new Error('Laporan tidak ditemukan')

  const canValidate = await canActorValidatePost(sessionUser, {
    userId: post.user_id.toString(),
    tenantId: post.tenant_id?.toString() ?? null,
  })
  if (!canValidate) throw new Error('Anda tidak memiliki akses untuk mengubah status laporan ini')

  if (!sessionUser.roles.includes('admin') && status !== 'pending') {
    const validDate = /^\d{4}-\d{2}-\d{2}$/
    if (!validDate.test(dateFrom) || !validDate.test(dateTo)) {
      throw new Error('Rentang tanggal tidak valid')
    }

    const [uploadCount, amplifikasiCount] = await Promise.all([
      prisma.blog_posts.count({
        where: {
          user_id: post.user_id,
          source_url: 'upload',
          created_at: {
            gte: getJakartaDateBounds(dateFrom, false),
            lte: getJakartaDateBounds(dateTo, true),
          },
        },
      }),
      prisma.blog_posts.count({
        where: {
          user_id: post.user_id,
          source_url: 'amplifikasi',
          created_at: {
            gte: getJakartaDateBounds(dateFrom, false),
            lte: getJakartaDateBounds(dateTo, true),
          },
        },
      }),
    ])

    if (uploadCount < 3 || amplifikasiCount < 3) {
      throw new Error('Validasi aktif setelah minimal 3 upload dan 3 amplifikasi terpenuhi.')
    }
  }

  await prisma.blog_posts.update({
    where: { id: BigInt(postId) },
    data: { status, updated_at: new Date() },
  })

  logEvent('info', 'posts.operator_update_status', {
    postId,
    userId: sessionUser.id,
    status,
    dateFrom,
    dateTo,
  })
  revalidatePath('/posts/users/[userId]', 'page')
  revalidatePath('/posts/users/[userId]/[status]', 'page')
  revalidatePosts()

  return {
    message: 'Status post berhasil diupdate.',
    success: 'updated',
  }
}

export async function bulkUpdateOperatorPostStatus(
  postIds: string[],
  status: 'valid' | 'invalid',
  dateFrom: string,
  dateTo: string,
) {
  const sessionUser = await requireManagerOrAdmin().catch(redirectToLoginIfUnauthorized)
  const reportingWindowDecision = await getNonAdminReportingWindowDecision(sessionUser.roles)
  if (!reportingWindowDecision.allowed) {
    throw new Error(reportingWindowDecision.message ?? 'Pelaporan sedang ditutup.')
  }

  const uniquePostIds = Array.from(new Set(postIds.filter((id) => /^\d+$/.test(id))))
  if (uniquePostIds.length === 0) throw new Error('Pilih minimal satu laporan')

  const validDate = /^\d{4}-\d{2}-\d{2}$/
  if (!validDate.test(dateFrom) || !validDate.test(dateTo)) {
    throw new Error('Rentang tanggal tidak valid')
  }

  const posts = await prisma.blog_posts.findMany({
    where: { id: { in: uniquePostIds.map((id) => BigInt(id)) } },
    select: { id: true, user_id: true, tenant_id: true },
  })
  if (posts.length !== uniquePostIds.length) throw new Error('Sebagian laporan tidak ditemukan')

  const userIds = new Set(posts.map((post) => post.user_id.toString()))
  if (userIds.size !== 1) throw new Error('Bulk validasi hanya dapat dilakukan untuk satu operator')

  for (const post of posts) {
    const canValidate = await canActorValidatePost(sessionUser, {
      userId: post.user_id.toString(),
      tenantId: post.tenant_id?.toString() ?? null,
    })
    if (!canValidate) throw new Error('Anda tidak memiliki akses untuk mengubah status laporan ini')
  }

  if (!sessionUser.roles.includes('admin')) {
    const userId = posts[0].user_id
    const [uploadCount, amplifikasiCount] = await Promise.all([
      prisma.blog_posts.count({
        where: {
          user_id: userId,
          source_url: 'upload',
          created_at: {
            gte: getJakartaDateBounds(dateFrom, false),
            lte: getJakartaDateBounds(dateTo, true),
          },
        },
      }),
      prisma.blog_posts.count({
        where: {
          user_id: userId,
          source_url: 'amplifikasi',
          created_at: {
            gte: getJakartaDateBounds(dateFrom, false),
            lte: getJakartaDateBounds(dateTo, true),
          },
        },
      }),
    ])

    if (uploadCount < 3 || amplifikasiCount < 3) {
      throw new Error('Validasi aktif setelah minimal 3 upload dan 3 amplifikasi terpenuhi.')
    }
  }

  await prisma.blog_posts.updateMany({
    where: { id: { in: posts.map((post) => post.id) } },
    data: { status, updated_at: new Date() },
  })

  logEvent('info', 'posts.operator_bulk_update_status', {
    postIds: uniquePostIds,
    count: uniquePostIds.length,
    userId: sessionUser.id,
    status,
    dateFrom,
    dateTo,
  })
  revalidatePath('/posts/users/[userId]', 'page')
  revalidatePath('/posts/users/[userId]/[status]', 'page')
  revalidatePosts()

  return {
    message: `${uniquePostIds.length} post berhasil diupdate.`,
    success: 'updated',
  }
}

export type PostErrors = { title?: string[]; body?: string[]; category_id?: string[]; screenshot?: string[] }

export type PostFormState =
  | {
      errors?: PostErrors
      message?: string
      duplicate?: boolean
    }
  | undefined

function getS3Key(media: { file_name: string; custom_properties: unknown }): string {
  const props = media.custom_properties as Record<string, unknown> | null
  if (props && typeof props.object_key === 'string') return props.object_key
  return media.file_name
}

export type SerializedPost = {
  id: string
  title: string | null
  slug: string | null
  body: string | null
  description: string | null
  status: string
  is_published: boolean
  published_at: string | null
  blog_post_category_id: string | null
  created_at: string | null
  category: { id: string; name: string } | null
  thumbnail: { id: string; uuid: string | null; file_name: string; url: string } | null
  user: { id: string; name: string } | null
  province: string | null
  city: string | null
  source_url: string | null
  tenant_id: string | null
}

export type SerializedCategory = {
  id: string
  name: string
}

const getCategoriesCached = cache(async () => {
  return prisma.blog_post_categories.findMany({
    orderBy: { name: 'asc' },
  })
})

function getJakartaDateBounds(dateString: string, endOfDay: boolean) {
  return new Date(`${dateString}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}+07:00`)
}

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
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  return `${base}-${suffix}`
}

async function deleteMediaAssets(mediaList: Array<{ id: bigint; file_name: string; custom_properties: unknown }>) {
  const failedS3Deletes: string[] = []

  await Promise.all(
    mediaList.map(async (media) => {
      try {
        await deleteFromS3(getS3Key(media))
      } catch (error) {
        failedS3Deletes.push(media.id.toString())
        logEvent('error', 'posts.media_delete.s3_failed', {
          mediaId: media.id.toString(),
          objectKey: getS3Key(media),
          error,
        })
      }
    })
  )

  if (mediaList.length > 0) {
    await prisma.media.deleteMany({
      where: { id: { in: mediaList.map((media) => media.id) } },
    })
  }

  return {
    deletedMediaCount: mediaList.length,
    failedS3Deletes,
  }
}

export async function getPosts(params: {
  search?: string
  categoryId?: string
  status?: 'pending' | 'valid' | 'invalid'
  page?: number
  pageSize?: TablePageSize
  userId?: string
  tenantId?: string
  tenantIds?: string[]
  dateFrom?: string
  dateTo?: string
  sortOrder?: 'asc' | 'desc'
  postType?: 'upload' | 'amplifikasi'
  provinceId?: string
  cityId?: string
}): Promise<{ posts: SerializedPost[]; total: number }> {
  const sessionUser = await requireUser()
  const scopedParams = { ...params }
  if (sessionUser.roles.includes('admin')) {
    return queryPosts(scopedParams) as Promise<{ posts: SerializedPost[]; total: number }>
  }
  if (sessionUser.roles.includes('manager')) {
    const tenantIds = await getUserTenantIds(sessionUser.id)
    if (tenantIds.length === 0) return { posts: [], total: 0 }
    if (scopedParams.tenantId && !tenantIds.includes(scopedParams.tenantId)) {
      return { posts: [], total: 0 }
    }
    scopedParams.tenantIds = scopedParams.tenantId ? [scopedParams.tenantId] : tenantIds
    delete scopedParams.tenantId
    return queryPosts(scopedParams) as Promise<{ posts: SerializedPost[]; total: number }>
  }
  scopedParams.userId = sessionUser.id
  delete scopedParams.tenantId
  delete scopedParams.tenantIds
  return queryPosts(scopedParams) as Promise<{ posts: SerializedPost[]; total: number }>

  const { search, categoryId, status, page = 1, pageSize = 10, userId, tenantId, dateFrom, dateTo, sortOrder = 'desc', postType, provinceId, cityId } = params
  const numericPageSize = pageSize === 'all' ? undefined : pageSize
  const skip = numericPageSize === undefined ? undefined : (page - 1) * Number(numericPageSize)
  const take = numericPageSize === undefined ? undefined : Number(numericPageSize)

  // Resolve user IDs for tenant scoping (manager sees all tenant members' posts)
  let userIdFilter: { user_id: bigint } | { user_id: { in: bigint[] } } | undefined
  if (tenantId) {
    const tenantUsers = await prisma.tenant_user.findMany({
      where: { tenant_id: BigInt(tenantId!) },
      select: { user_id: true },
    })
    userIdFilter = { user_id: { in: tenantUsers.map((tu) => tu.user_id) } }
  } else if (userId) {
    userIdFilter = { user_id: BigInt(userId!) }
  }

  // Province/city scoping via addresses → tenant_id
  let provinceCityTenantFilter: { tenant_id: { in: bigint[] } } | undefined
  if (provinceId || cityId) {
    const conditions: string[] = ['a.tenant_id IS NOT NULL']
    const queryParams: unknown[] = []
    let idx = 1

    if (provinceId) {
      conditions.push(`c.province_id = $${idx}`)
      queryParams.push(parseInt(provinceId!, 10))
      idx++
    }

    if (cityId) {
      conditions.push(`a.city_id = $${idx}`)
      queryParams.push(parseInt(cityId!, 10))
    }

    const addressMatches = await prisma.$queryRawUnsafe<{ tenant_id: bigint | null }[]>(
      `SELECT a.tenant_id
       FROM addresses a
       INNER JOIN reg_cities c ON c.id = a.city_id
       WHERE ${conditions.join(' AND ')}`,
      ...queryParams
    )
    const matchingTenantIds = Array.from(
      new Set(
        addressMatches
          .map((a) => a.tenant_id)
          .filter((id): id is bigint => id !== null)
      )
    )
    if (matchingTenantIds.length === 0) {
      return { posts: [], total: 0 }
    }
    provinceCityTenantFilter = { tenant_id: { in: matchingTenantIds } }
  }

  const where = {
    ...userIdFilter,
    ...provinceCityTenantFilter,
    ...(search && {
      OR: [
        { title: { contains: search, mode: 'insensitive' as const } },
        { slug: { contains: search, mode: 'insensitive' as const } },
        { description: { contains: search, mode: 'insensitive' as const } },
        { blog_post_categories: { name: { contains: search, mode: 'insensitive' as const } } },
        { users_blog_posts_user_idTousers: { name: { contains: search, mode: 'insensitive' as const } } },
      ],
    }),
    ...(categoryId && {
      blog_post_category_id: BigInt(categoryId!),
    }),
    ...(status && {
      status,
    }),
    ...((dateFrom || dateTo) && {
      created_at: {
        ...(dateFrom && { gte: getJakartaDateBounds(dateFrom!, false) }),
        ...(dateTo && { lte: getJakartaDateBounds(dateTo!, true) }),
      },
    }),
    ...(postType ? { source_url: postType } : {}),
  }

  const [posts, total] = await Promise.all([
    prisma.blog_posts.findMany({
      where,
      orderBy: { created_at: sortOrder },
      skip,
      take,
      include: {
        blog_post_categories: true,
        users_blog_posts_user_idTousers: { select: { id: true, name: true } },
      },
    }),
    prisma.blog_posts.count({ where }),
  ])

  const postIds = posts.map((p) => p.id)
  const mediaList = await prisma.media.findMany({
    where: {
      model_type: 'App\\Models\\BlogPost',
      model_id: { in: postIds },
      collection_name: 'blog-images',
    },
  })

  const mediaByPostId = new Map(mediaList.map((m) => [m.model_id.toString(), m]))

  // Fetch province/city via tenant_user → addresses
  const userIds = [...new Set(posts.map((p) => p.user_id))]
  const tenantUsers = userIds.length
    ? await prisma.tenant_user.findMany({
        where: { user_id: { in: userIds } },
        select: { user_id: true, tenant_id: true },
      })
    : []

  const tenantIdByUserId = new Map(tenantUsers.map((tu) => [tu.user_id.toString(), tu.tenant_id]))
  const tenantIds = [...new Set(tenantUsers.map((tu) => tu.tenant_id))]

  const addressList = tenantIds.length
    ? await prisma.addresses.findMany({
        where: { tenant_id: { in: tenantIds } },
        select: { tenant_id: true, city_id: true },
      })
    : []

  const cityIds = [...new Set(addressList.map((a) => a.city_id).filter((id): id is number => id !== null))]

  const cities = cityIds.length
    ? await prisma.reg_cities.findMany({
        where: { id: { in: cityIds.map((id) => BigInt(id)) } },
        select: { id: true, name: true, province_id: true },
      })
    : []

  const provinceIds = [...new Set(cities.map((city) => city.province_id))]
  const provinces = provinceIds.length
    ? await prisma.reg_provinces.findMany({ where: { id: { in: provinceIds } } })
    : []

  const provinceMap = new Map(provinces.map((p) => [p.id, p.name]))
  const cityMap = new Map(cities.map((c) => [Number(c.id), c]))
  const addressByTenantId = new Map(addressList.map((a) => [a.tenant_id?.toString(), a]))

  return {
    posts: posts.map((p) => {
      const media = mediaByPostId.get(p.id.toString())
      const tenantId = tenantIdByUserId.get(p.user_id.toString())
      const address = tenantId ? addressByTenantId.get(tenantId.toString()) : null
      return {
        id: p.id.toString(),
        title: p.title,
        slug: p.slug,
        body: p.body,
        description: p.description ?? null,
        status: p.status ?? 'pending',
        is_published: p.is_published,
        published_at: p.published_at?.toISOString() ?? null,
        blog_post_category_id: p.blog_post_category_id?.toString() ?? null,
        created_at: p.created_at?.toISOString() ?? null,
        category: p.blog_post_categories
          ? {
              id: p.blog_post_categories.id.toString(),
              name: p.blog_post_categories.name,
            }
          : null,
        source_url: p.source_url ?? null,
        thumbnail: media
          ? {
              id: media.id.toString(),
              uuid: media.uuid ?? null,
              file_name: media.file_name,
              url: getMediaUrl(getS3Key(media)),
            }
          : null,
        user: p.users_blog_posts_user_idTousers
          ? { id: p.users_blog_posts_user_idTousers.id.toString(), name: p.users_blog_posts_user_idTousers.name }
          : null,
        province: address?.city_id ? provinceMap.get(cityMap.get(address.city_id)?.province_id ?? 0) ?? null : null,
        city: address?.city_id ? cityMap.get(address.city_id)?.name ?? null : null,
        tenant_id: p.tenant_id?.toString() ?? null,
      }
    }),
    total,
  }
}

export async function getCategories(): Promise<SerializedCategory[]> {
  await requireUser()
  const cats = await getCategoriesCached()
  return cats.map((c) => ({ id: c.id.toString(), name: c.name }))
}

export async function getPostById(id: string): Promise<SerializedPost | null> {
  const sessionUser = await requireUser()
  const result = await queryPostById(id)
  if (!result) return null
  const canRead = await canActorReadPost(sessionUser, {
    userId: result.user?.id ?? null,
    tenantId: result.tenant_id,
  })
  if (!canRead) return null
  return result as SerializedPost
}

async function uploadScreenshot(
  file: File,
  postId: bigint,
  reportKind: 'default' | 'upload' | 'amplifikasi',
  uploadedBy: string,
  location: ReportObjectLocation,
): Promise<void> {
  const { randomUUID } = await import('crypto')
  const { buildReportObjectKey, uploadToS3 } = await import('@/app/lib/s3')

  const buffer = Buffer.from(await file.arrayBuffer())
  const detectedFile = detectAllowedImage(buffer)
  if (!detectedFile) {
    throw new Error('Tipe file tidak didukung. Gunakan JPG, PNG, GIF, atau WebP.')
  }
  const uuid = randomUUID()
  const ext = detectedFile.ext
  const { fileName, objectKey } = buildReportObjectKey(ext, reportKind, location)

  const media = await prisma.media.create({
    data: {
      model_type: 'App\\Models\\BlogPost',
      model_id: postId,
      uuid,
      collection_name: 'blog-images',
      name: file.name,
      file_name: 'pending',
      mime_type: detectedFile.mime,
      disk: 's3',
      conversions_disk: 's3',
      size: BigInt(file.size),
      manipulations: {},
      custom_properties: { uploaded_by: uploadedBy },
      generated_conversions: {},
      responsive_images: {},
    },
  })

  const publicUrl = `${process.env.NEXT_PUBLIC_S3_PUBLIC_URL}/${objectKey}`

  try {
    await uploadToS3(buffer, objectKey, detectedFile.mime)
  } catch (err) {
    await prisma.media.delete({ where: { id: media.id } })
    throw err
  }

  await prisma.media.update({
    where: { id: media.id },
    data: {
      file_name: fileName,
      custom_properties: { source_url: publicUrl, object_key: objectKey, uploaded_by: uploadedBy },
    },
  })
}

type PostVariantOpts = {
  requireTitle: boolean
  requireScreenshot: boolean
  validateUrl: boolean
  sourceUrl: string | null
  redirectBase: string
}

async function processCreate(formData: FormData, opts: PostVariantOpts): Promise<PostFormState> {
  const sessionUser = assertNotManagerOnly(await requireUser().catch(redirectToLoginIfUnauthorized))
  const reportingWindowDecision = await getOperatorReportingWindowDecision(sessionUser.roles)
  if (!reportingWindowDecision.allowed) {
    return { message: reportingWindowDecision.message ?? 'Pelaporan operator sedang ditutup.' }
  }

  const rawTitle = (formData.get('title') as string)?.trim()
  const title = rawTitle || '-'
  const body = (formData.get('body') as string)?.trim()
  const description = (formData.get('description') as string)?.trim() || null
  const categoryId = formData.get('category_id') as string | null
  const isPublished = formData.get('is_published') === '1'
  const screenshot = formData.get('screenshot') as File | null
  const { maxUploadedFileSizeBytes } = await getSecuritySettings()

  const errors: PostErrors = {}

  if (!categoryId) errors.category_id = ['Kategori wajib dipilih.']
  if (opts.requireTitle && !rawTitle) errors.title = ['Link upload tidak boleh kosong.']
  if (opts.requireScreenshot) {
    if (!screenshot || screenshot.size === 0) {
      errors.screenshot = ['Bukti screenshot wajib diupload.']
    } else if (screenshot.size > maxUploadedFileSizeBytes) {
      errors.screenshot = [`Ukuran file terlalu besar (maks ${formatUploadFileSize(maxUploadedFileSizeBytes)}).`]
    } else {
      const detectedFile = detectAllowedImage(Buffer.from(await screenshot.arrayBuffer()))
      if (!detectedFile) {
        errors.screenshot = ['Tipe file tidak didukung. Gunakan JPG, PNG, GIF, atau WebP.']
      }
    }
  }

  if (Object.keys(errors).length > 0) return { errors }

  if (opts.validateUrl && categoryId && rawTitle) {
    const category = await prisma.blog_post_categories.findUnique({
      where: { id: BigInt(categoryId) },
      select: { name: true },
    })
    if (category) {
      const urlError = validateUrlForCategory(rawTitle, category.name)
      if (urlError) return { errors: { title: [urlError] } }
    }
  }

  const userId = BigInt(sessionUser.id)
  const tenantUser = await prisma.tenant_user.findFirst({
    where: { user_id: userId },
    select: { tenant_id: true },
  })

  if (categoryId && opts.sourceUrl !== 'amplifikasi') {
    const now = new Date()
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0)
    const endOfDay   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
    const existing = await prisma.blog_posts.findFirst({
      where: {
        user_id: userId,
        blog_post_category_id: BigInt(categoryId),
        source_url: opts.sourceUrl ?? null,
        created_at: { gte: startOfDay, lte: endOfDay },
      },
      select: { id: true },
    })
    if (existing) {
      const category = await prisma.blog_post_categories.findUnique({
        where: { id: BigInt(categoryId) },
        select: { name: true },
      })
      return {
        message: `Double entry terdeteksi! Anda sudah mengirim laporan kategori "${category?.name ?? 'ini'}" hari ini. Setiap operator hanya diizinkan satu laporan per kategori per hari.`,
        duplicate: true,
      }
    }
  }

  if (opts.sourceUrl === 'amplifikasi') {
    const amplifikasiCount = await countUserAmplifikasiToday(sessionUser.id)
    if (amplifikasiCount >= AMPLIFIKASI_DAILY_LIMIT) {
      return {
        message: `Batas amplifikasi hari ini sudah tercapai. Maksimal ${AMPLIFIKASI_DAILY_LIMIT} laporan per hari.`,
      }
    }
  }

  const post = await prisma.blog_posts.create({
    data: {
      title,
      slug: generateSlug(title),
      body: body || '-',
      description,
      status: 'pending',
      is_published: isPublished,
      published_at: isPublished ? new Date() : null,
      user_id: userId,
      tenant_id: tenantUser?.tenant_id ?? null,
      blog_post_category_id: categoryId ? BigInt(categoryId) : null,
      source_url: opts.sourceUrl,
      created_at: new Date(),
    },
  })

  if (opts.requireScreenshot && screenshot && screenshot.size > 0) {
    const location = await getReportLocationByTenantId(post.tenant_id)
    await uploadScreenshot(screenshot, post.id, opts.sourceUrl === 'upload' || opts.sourceUrl === 'amplifikasi' ? opts.sourceUrl : 'default', sessionUser.id, location)
  }

  logEvent('info', 'posts.create', { postId: post.id.toString(), userId: sessionUser.id, categoryId, sourceUrl: opts.sourceUrl })
  revalidatePath(opts.redirectBase)
  redirect(`${opts.redirectBase}?success=created`)
}

async function processUpdate(formData: FormData, opts: PostVariantOpts): Promise<PostFormState> {
  const sessionUser = await requireUser().catch(redirectToLoginIfUnauthorized)
  const reportingWindowDecision = await getNonAdminReportingWindowDecision(sessionUser.roles)
  if (!reportingWindowDecision.allowed) {
    return { message: reportingWindowDecision.message ?? 'Pelaporan operator sedang ditutup.' }
  }

  const id = formData.get('id') as string
  if (!id || !/^\d+$/.test(id)) {
    return { message: 'ID laporan tidak valid.' }
  }
  const rawTitle = (formData.get('title') as string)?.trim()
  const title = rawTitle || '-'
  const body = (formData.get('body') as string)?.trim()
  const description = (formData.get('description') as string)?.trim() || null
  const categoryId = formData.get('category_id') as string | null
  const isPublished = formData.get('is_published') === '1'
  const oldMediaId = formData.get('old_media_id') as string | null
  const returnTo = normalizeReturnTo(formData.get('return_to') as string | null, opts.redirectBase)
  const screenshot = formData.get('screenshot') as File | null
  const hasNewScreenshot = screenshot && screenshot.size > 0
  const { maxUploadedFileSizeBytes } = await getSecuritySettings()

  const errors: PostErrors = {}

  if (!categoryId) errors.category_id = ['Kategori wajib dipilih.']
  if (opts.requireTitle && !rawTitle) errors.title = ['Link upload tidak boleh kosong.']
  if (opts.requireScreenshot) {
    if (!oldMediaId && (!screenshot || screenshot.size === 0)) {
      errors.screenshot = ['Bukti screenshot wajib diupload.']
    } else if (hasNewScreenshot) {
      if (screenshot.size > maxUploadedFileSizeBytes) {
        errors.screenshot = [`Ukuran file terlalu besar (maks ${formatUploadFileSize(maxUploadedFileSizeBytes)}).`]
      } else {
        const detectedFile = detectAllowedImage(Buffer.from(await screenshot.arrayBuffer()))
        if (!detectedFile) {
          errors.screenshot = ['Tipe file tidak didukung. Gunakan JPG, PNG, GIF, atau WebP.']
        }
      }
    }
  }

  if (Object.keys(errors).length > 0) return { errors }

  const existingPost = await getPostById(id)
  if (!existingPost) {
    return { message: 'Laporan tidak ditemukan.' }
  }

  const canEdit = await canUserEditPost(sessionUser, {
    userId: existingPost.user?.id ?? null,
    tenantId: existingPost.tenant_id ?? null,
  })
  if (!canEdit) {
    return { message: 'Anda tidak memiliki akses untuk mengedit laporan ini.' }
  }

  if (opts.validateUrl && categoryId && rawTitle) {
    const category = await prisma.blog_post_categories.findUnique({
      where: { id: BigInt(categoryId) },
      select: { name: true },
    })
    if (category) {
      const urlError = validateUrlForCategory(rawTitle, category.name)
      if (urlError) return { errors: { title: [urlError] } }
    }
  }

  await prisma.blog_posts.update({
    where: { id: BigInt(id) },
    data: {
      title,
      slug: generateSlug(title),
      body: body || '-',
      description,
      is_published: isPublished,
      published_at: isPublished && !existingPost.is_published ? new Date() : isPublished ? undefined : null,
      blog_post_category_id: categoryId ? BigInt(categoryId) : null,
      updated_at: new Date(),
    },
  })

  if (opts.requireScreenshot && hasNewScreenshot) {
    const oldMedia = await prisma.media.findFirst({
      where: {
        model_type: 'App\\Models\\BlogPost',
        model_id: BigInt(id),
        collection_name: 'blog-images',
        ...(oldMediaId ? { id: BigInt(oldMediaId) } : {}),
      },
    })
    if (oldMedia) {
      await deleteFromS3(getS3Key(oldMedia)).catch(() => {})
      await prisma.media.delete({ where: { id: oldMedia.id } })
    }
    const location = await getReportLocationByTenantId(existingPost.tenant_id)
    await uploadScreenshot(screenshot, BigInt(id), opts.sourceUrl === 'upload' || opts.sourceUrl === 'amplifikasi' ? opts.sourceUrl : 'default', sessionUser.id, location)
  }

  logEvent('info', 'posts.update', { postId: id, userId: sessionUser.id, categoryId, sourceUrl: opts.sourceUrl })
  revalidatePath(opts.redirectBase)
  const returnPath = getPathname(returnTo)
  if (returnPath !== opts.redirectBase) {
    revalidatePath(returnPath)
  }
  redirect(appendSuccessParam(returnTo, 'updated'))
}

function revalidatePosts() {
  revalidatePath('/posts')
  revalidatePath('/posts/upload')
  revalidatePath('/posts/amplifikasi')
}

const DEFAULT_OPTS: PostVariantOpts = { requireTitle: true, requireScreenshot: true, validateUrl: true, sourceUrl: null, redirectBase: '/posts' }
const UPLOAD_OPTS: PostVariantOpts  = { requireTitle: true, requireScreenshot: false, validateUrl: true, sourceUrl: 'upload', redirectBase: '/posts/upload' }
const AMPLIF_OPTS: PostVariantOpts  = { requireTitle: false, requireScreenshot: true, validateUrl: false, sourceUrl: 'amplifikasi', redirectBase: '/posts/amplifikasi' }

export async function createPost(_state: PostFormState, formData: FormData): Promise<PostFormState> {
  await requireUser().catch(redirectToLoginIfUnauthorized)
  return processCreate(formData, DEFAULT_OPTS)
}
export async function createUpload(_state: PostFormState, formData: FormData): Promise<PostFormState> {
  await requireUser().catch(redirectToLoginIfUnauthorized)
  return processCreate(formData, UPLOAD_OPTS)
}
export async function createAmplifikasi(_state: PostFormState, formData: FormData): Promise<PostFormState> {
  await requireUser().catch(redirectToLoginIfUnauthorized)
  return processCreate(formData, AMPLIF_OPTS)
}

export async function updatePost(_state: PostFormState, formData: FormData): Promise<PostFormState> {
  await requireUser().catch(redirectToLoginIfUnauthorized)
  return processUpdate(formData, DEFAULT_OPTS)
}
export async function updateUpload(_state: PostFormState, formData: FormData): Promise<PostFormState> {
  await requireUser().catch(redirectToLoginIfUnauthorized)
  return processUpdate(formData, UPLOAD_OPTS)
}
export async function updateAmplifikasi(_state: PostFormState, formData: FormData): Promise<PostFormState> {
  await requireUser().catch(redirectToLoginIfUnauthorized)
  return processUpdate(formData, AMPLIF_OPTS)
}

export async function deletePost(id: string): Promise<void> {
  const sessionUser = assertAdmin(await requireUser().catch(redirectToLoginIfUnauthorized))

  const mediaList = await prisma.media.findMany({
    where: { model_type: 'App\\Models\\BlogPost', model_id: BigInt(id), collection_name: 'blog-images' },
  })

  const { deletedMediaCount, failedS3Deletes } = await deleteMediaAssets(mediaList)

  await prisma.blog_posts.delete({ where: { id: BigInt(id) } })
  logEvent('warn', 'posts.delete', {
    postId: id,
    userId: sessionUser.id,
    deletedMediaCount,
    failedS3Deletes,
  })
  revalidatePosts()
}

export async function bulkDeletePosts(ids: string[]): Promise<void> {
  const sessionUser = assertAdmin(await requireUser().catch(redirectToLoginIfUnauthorized))
  if (ids.length === 0) return

  const bigIds = ids.map((id) => BigInt(id))

  const mediaList = await prisma.media.findMany({
    where: { model_type: 'App\\Models\\BlogPost', model_id: { in: bigIds }, collection_name: 'blog-images' },
  })

  const { deletedMediaCount, failedS3Deletes } = await deleteMediaAssets(mediaList)

  await prisma.blog_posts.deleteMany({ where: { id: { in: bigIds } } })
  logEvent('warn', 'posts.bulk_delete', {
    postIds: ids,
    userId: sessionUser.id,
    deletedMediaCount,
    failedS3Deletes,
  })
  revalidatePosts()
}

export async function togglePublish(id: string, currentStatus: boolean): Promise<void> {
  const sessionUser = assertAdmin(await requireManagerOrAdmin().catch(redirectToLoginIfUnauthorized))
  await prisma.blog_posts.update({
    where: { id: BigInt(id) },
    data: {
      is_published: !currentStatus,
      published_at: !currentStatus ? new Date() : null,
      updated_at: new Date(),
    },
  })
  logEvent('info', 'posts.toggle_publish', {
    postId: id,
    userId: sessionUser.id,
    nextStatus: !currentStatus,
  })
  revalidatePosts()
}

export async function updateStatus(id: string, status: 'pending' | 'valid' | 'invalid'): Promise<void> {
  const sessionUser = await requireManagerOrAdmin().catch(redirectToLoginIfUnauthorized)
  const reportingWindowDecision = await getNonAdminReportingWindowDecision(sessionUser.roles)
  if (!reportingWindowDecision.allowed) {
    throw new Error(reportingWindowDecision.message ?? 'Pelaporan sedang ditutup.')
  }
  if (!sessionUser.roles.includes('admin') && status !== 'pending') {
    throw new Error('Validasi manager dilakukan dari halaman View operator.')
  }
  const post = await prisma.blog_posts.findUnique({
    where: { id: BigInt(id) },
    select: { user_id: true, tenant_id: true },
  })
  if (!post) throw new Error('Laporan tidak ditemukan')
  const canValidate = await canActorValidatePost(sessionUser, {
    userId: post.user_id.toString(),
    tenantId: post.tenant_id?.toString() ?? null,
  })
  if (!canValidate) throw new Error('Anda tidak memiliki akses untuk mengubah status laporan ini')

  await prisma.blog_posts.update({
    where: { id: BigInt(id) },
    data: {
      status,
      updated_at: new Date(),
    },
  })
  logEvent('info', 'posts.update_status', {
    postId: id,
    userId: sessionUser.id,
    status,
  })
  revalidatePosts()
}
