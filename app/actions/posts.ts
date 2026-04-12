'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/app/lib/prisma'
import { deleteFromS3, getMediaUrl } from '@/app/lib/s3'
import { getSessionUser } from '@/app/lib/session'

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
}

export type SerializedCategory = {
  id: string
  name: string
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

export async function getPosts(params: {
  search?: string
  categoryId?: string
  page?: number
  userId?: string
  tenantId?: string
  dateFrom?: string
  dateTo?: string
  sortOrder?: 'asc' | 'desc'
}): Promise<{ posts: SerializedPost[]; total: number }> {
  const { search, categoryId, page = 1, userId, tenantId, dateFrom, dateTo, sortOrder = 'desc' } = params
  const pageSize = 10
  const skip = (page - 1) * pageSize

  // Resolve user IDs for tenant scoping (manager sees all tenant members' posts)
  let userIdFilter: { user_id: bigint } | { user_id: { in: bigint[] } } | undefined
  if (tenantId) {
    const tenantUsers = await prisma.tenant_user.findMany({
      where: { tenant_id: BigInt(tenantId) },
      select: { user_id: true },
    })
    userIdFilter = { user_id: { in: tenantUsers.map((tu) => tu.user_id) } }
  } else if (userId) {
    userIdFilter = { user_id: BigInt(userId) }
  }

  const where = {
    ...userIdFilter,
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
      blog_post_category_id: BigInt(categoryId),
    }),
    ...((dateFrom || dateTo) && {
      created_at: {
        ...(dateFrom && { gte: new Date(dateFrom) }),
        ...(dateTo && { lte: new Date(dateTo + 'T23:59:59') }),
      },
    }),
  }

  const [posts, total] = await Promise.all([
    prisma.blog_posts.findMany({
      where,
      orderBy: { created_at: sortOrder },
      skip,
      take: pageSize,
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
        select: { tenant_id: true, province_id: true, city_id: true },
      })
    : []

  const provinceIds = [...new Set(addressList.map((a) => a.province_id).filter((id): id is number => id !== null))]
  const cityIds = [...new Set(addressList.map((a) => a.city_id).filter((id): id is number => id !== null))]

  const [provinces, cities] = await Promise.all([
    provinceIds.length
      ? prisma.reg_provinces.findMany({ where: { id: { in: provinceIds } } })
      : [],
    cityIds.length
      ? prisma.reg_cities.findMany({ where: { id: { in: cityIds.map((id) => BigInt(id)) } } })
      : [],
  ])

  const provinceMap = new Map(provinces.map((p) => [p.id, p.name]))
  const cityMap = new Map(cities.map((c) => [Number(c.id), c.name]))
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
        province: address?.province_id ? provinceMap.get(address.province_id) ?? null : null,
        city: address?.city_id ? cityMap.get(address.city_id) ?? null : null,
      }
    }),
    total,
  }
}

export async function getCategories(): Promise<SerializedCategory[]> {
  const cats = await prisma.blog_post_categories.findMany({
    orderBy: { name: 'asc' },
  })
  return cats.map((c) => ({ id: c.id.toString(), name: c.name }))
}

export async function getPostById(id: string): Promise<SerializedPost | null> {
  const post = await prisma.blog_posts.findUnique({
    where: { id: BigInt(id) },
    include: { blog_post_categories: true, users_blog_posts_user_idTousers: { select: { id: true, name: true } } },
  })
  if (!post) return null

  const media = await prisma.media.findFirst({
    where: { model_type: 'App\\Models\\BlogPost', model_id: post.id, collection_name: 'blog-images' },
  })

  let provinceName: string | null = null
  let cityName: string | null = null
  const tenantUser = await prisma.tenant_user.findFirst({
    where: { user_id: post.user_id },
    select: { tenant_id: true },
  })
  if (tenantUser) {
    const address = await prisma.addresses.findFirst({
      where: { tenant_id: tenantUser.tenant_id },
      select: { province_id: true, city_id: true },
    })
    if (address?.province_id) {
      const prov = await prisma.reg_provinces.findUnique({ where: { id: address.province_id } })
      provinceName = prov?.name ?? null
    }
    if (address?.city_id) {
      const city = await prisma.reg_cities.findUnique({ where: { id: BigInt(address.city_id) } })
      cityName = city?.name ?? null
    }
  }

  return {
    id: post.id.toString(),
    title: post.title,
    slug: post.slug,
    body: post.body,
    description: post.description ?? null,
    status: post.status ?? 'pending',
    is_published: post.is_published,
    published_at: post.published_at?.toISOString() ?? null,
    blog_post_category_id: post.blog_post_category_id?.toString() ?? null,
    created_at: post.created_at?.toISOString() ?? null,
    category: post.blog_post_categories
      ? { id: post.blog_post_categories.id.toString(), name: post.blog_post_categories.name }
      : null,
    thumbnail: media
      ? {
          id: media.id.toString(),
          uuid: media.uuid ?? null,
          file_name: media.file_name,
          url: getMediaUrl(getS3Key(media)),
        }
      : null,
    user: post.users_blog_posts_user_idTousers
      ? { id: post.users_blog_posts_user_idTousers.id.toString(), name: post.users_blog_posts_user_idTousers.name }
      : null,
    province: provinceName,
    city: cityName,
  }
}

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
const MAX_IMAGE_SIZE = 1 * 1024 * 1024 // 1MB

async function uploadScreenshot(file: File, postId: bigint): Promise<void> {
  const { randomBytes, randomUUID } = await import('crypto')
  const { uploadToS3 } = await import('@/app/lib/s3')

  const buffer = Buffer.from(await file.arrayBuffer())
  const uuid = randomUUID()
  const hash = randomBytes(16).toString('hex')
  const ext = file.name.split('.').pop() ?? 'jpg'
  const fileName = `blog-images-${hash}.${ext}`

  const media = await prisma.media.create({
    data: {
      model_type: 'App\\Models\\BlogPost',
      model_id: postId,
      uuid,
      collection_name: 'blog-images',
      name: file.name,
      file_name: 'pending',
      mime_type: file.type,
      disk: 's3',
      conversions_disk: 's3',
      size: BigInt(file.size),
      manipulations: {},
      custom_properties: {},
      generated_conversions: {},
      responsive_images: {},
    },
  })

  const objectKey = `${media.id}/${fileName}`
  const publicUrl = `${process.env.NEXT_PUBLIC_S3_PUBLIC_URL}/${objectKey}`

  try {
    await uploadToS3(buffer, objectKey, file.type)
  } catch (err) {
    await prisma.media.delete({ where: { id: media.id } })
    throw err
  }

  await prisma.media.update({
    where: { id: media.id },
    data: {
      file_name: fileName,
      custom_properties: { source_url: publicUrl, object_key: objectKey },
    },
  })
}

export async function createPost(
  state: PostFormState,
  formData: FormData
): Promise<PostFormState> {
  const sessionUser = await getSessionUser()
  if (!sessionUser) throw new Error('Unauthorized')
  const isAdmin = sessionUser.roles.includes('admin')
  const isManager = sessionUser.roles.includes('manager')
  if (isManager && !isAdmin) throw new Error('Unauthorized')

  const title = (formData.get('title') as string)?.trim()
  const body = (formData.get('body') as string)?.trim()
  const description = (formData.get('description') as string)?.trim() || null
  const categoryId = formData.get('category_id') as string | null
  const isPublished = formData.get('is_published') === '1'
  const screenshot = formData.get('screenshot') as File | null

  const errors: PostErrors = {}

  if (!categoryId) errors.category_id = ['Kategori wajib dipilih.']
  if (!title) errors.title = ['Link upload tidak boleh kosong.']
  if (!screenshot || screenshot.size === 0) {
    errors.screenshot = ['Bukti screenshot wajib diupload.']
  } else if (!ALLOWED_IMAGE_TYPES.includes(screenshot.type)) {
    errors.screenshot = ['Tipe file tidak didukung. Gunakan JPG, PNG, GIF, atau WebP.']
  } else if (screenshot.size > MAX_IMAGE_SIZE) {
    errors.screenshot = ['Ukuran file terlalu besar (maks 1MB).']
  }

  if (Object.keys(errors).length > 0) return { errors }

  // Validate URL matches the selected platform category
  if (categoryId) {
    const category = await prisma.blog_post_categories.findUnique({
      where: { id: BigInt(categoryId) },
      select: { name: true },
    })
    if (category) {
      const urlError = validateUrlForCategory(title, category.name)
      if (urlError) return { errors: { title: [urlError] } }
    }
  }

  const userId = BigInt(sessionUser.id)
  const tenantUser = await prisma.tenant_user.findFirst({
    where: { user_id: userId },
    select: { tenant_id: true },
  })

  // Duplicate check: same user + same category + same calendar date
  if (categoryId) {
    const now = new Date()
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0)
    const endOfDay   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
    const existing = await prisma.blog_posts.findFirst({
      where: {
        user_id: userId,
        blog_post_category_id: BigInt(categoryId),
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

  const post = await prisma.blog_posts.create({
    data: {
      title,
      slug: generateSlug(title),
      body,
      description,
      status: 'pending',
      is_published: isPublished,
      published_at: isPublished ? new Date() : null,
      user_id: userId,
      tenant_id: tenantUser?.tenant_id ?? null,
      blog_post_category_id: categoryId ? BigInt(categoryId) : null,
      created_at: new Date(),
    },
  })

  // Upload screenshot to S3 now that we have the post ID
  await uploadScreenshot(screenshot!, post.id)

  revalidatePath('/posts')
  redirect('/posts')
}

export async function updatePost(
  state: PostFormState,
  formData: FormData
): Promise<PostFormState> {
  const sessionUser = await getSessionUser()
  if (!sessionUser) throw new Error('Unauthorized')
  const isAdmin = sessionUser.roles.includes('admin')
  const isManager = sessionUser.roles.includes('manager')
  if (isManager && !isAdmin) throw new Error('Unauthorized')

  const id = formData.get('id') as string
  const title = (formData.get('title') as string)?.trim()
  const body = (formData.get('body') as string)?.trim()
  const description = (formData.get('description') as string)?.trim() || null
  const categoryId = formData.get('category_id') as string | null
  const isPublished = formData.get('is_published') === '1'
  const oldMediaId = formData.get('old_media_id') as string | null
  const screenshot = formData.get('screenshot') as File | null
  const hasNewScreenshot = screenshot && screenshot.size > 0

  const errors: PostErrors = {}

  if (!categoryId) errors.category_id = ['Kategori wajib dipilih.']
  if (!title) errors.title = ['Link upload tidak boleh kosong.']
  // Screenshot required only if no existing media
  if (!oldMediaId && (!screenshot || screenshot.size === 0)) {
    errors.screenshot = ['Bukti screenshot wajib diupload.']
  } else if (hasNewScreenshot) {
    if (!ALLOWED_IMAGE_TYPES.includes(screenshot.type)) {
      errors.screenshot = ['Tipe file tidak didukung. Gunakan JPG, PNG, GIF, atau WebP.']
    } else if (screenshot.size > MAX_IMAGE_SIZE) {
      errors.screenshot = ['Ukuran file terlalu besar (maks 1MB).']
    }
  }

  if (Object.keys(errors).length > 0) return { errors }

  // Validate URL matches the selected platform category
  if (categoryId) {
    const category = await prisma.blog_post_categories.findUnique({
      where: { id: BigInt(categoryId) },
      select: { name: true },
    })
    if (category) {
      const urlError = validateUrlForCategory(title, category.name)
      if (urlError) return { errors: { title: [urlError] } }
    }
  }

  const currentPost = await prisma.blog_posts.findUnique({
    where: { id: BigInt(id) },
    select: { is_published: true },
  })

  await prisma.blog_posts.update({
    where: { id: BigInt(id) },
    data: {
      title,
      slug: generateSlug(title),
      body,
      description,
      is_published: isPublished,
      published_at:
        isPublished && !currentPost?.is_published
          ? new Date()
          : isPublished
            ? undefined
            : null,
      blog_post_category_id: categoryId ? BigInt(categoryId) : null,
      updated_at: new Date(),
    },
  })

  // If new screenshot selected: delete old from S3, upload new
  if (hasNewScreenshot) {
    if (oldMediaId) {
      const oldMedia = await prisma.media.findUnique({ where: { id: BigInt(oldMediaId) } })
      if (oldMedia) {
        await deleteFromS3(getS3Key(oldMedia)).catch(() => {})
        await prisma.media.delete({ where: { id: BigInt(oldMediaId) } })
      }
    }
    await uploadScreenshot(screenshot, BigInt(id))
  }

  revalidatePath('/posts')
  redirect('/posts')
}

export async function deletePost(id: string): Promise<void> {
  const sessionUser = await getSessionUser()
  if (!sessionUser || !sessionUser.roles.includes('admin')) {
    throw new Error('Unauthorized')
  }

  const media = await prisma.media.findFirst({
    where: { model_type: 'App\\Models\\BlogPost', model_id: BigInt(id), collection_name: 'blog-images' },
  })

  if (media) {
    await deleteFromS3(getS3Key(media)).catch(() => {})
    await prisma.media.delete({ where: { id: media.id } })
  }

  await prisma.blog_posts.delete({ where: { id: BigInt(id) } })
  revalidatePath('/posts')
}

export async function bulkDeletePosts(ids: string[]): Promise<void> {
  if (ids.length === 0) return

  const sessionUser = await getSessionUser()
  if (!sessionUser || !sessionUser.roles.includes('admin')) {
    throw new Error('Unauthorized')
  }

  const bigIds = ids.map((id) => BigInt(id))

  const mediaList = await prisma.media.findMany({
    where: { model_type: 'App\\Models\\BlogPost', model_id: { in: bigIds }, collection_name: 'blog-images' },
  })

  await Promise.all(mediaList.map((m) => deleteFromS3(getS3Key(m)).catch(() => {})))

  if (mediaList.length > 0) {
    await prisma.media.deleteMany({
      where: { id: { in: mediaList.map((m) => m.id) } },
    })
  }

  await prisma.blog_posts.deleteMany({ where: { id: { in: bigIds } } })
  revalidatePath('/posts')
}

export async function togglePublish(id: string, currentStatus: boolean): Promise<void> {
  await prisma.blog_posts.update({
    where: { id: BigInt(id) },
    data: {
      is_published: !currentStatus,
      published_at: !currentStatus ? new Date() : null,
      updated_at: new Date(),
    },
  })
  revalidatePath('/posts')
}

export async function updateStatus(id: string, status: 'pending' | 'valid' | 'invalid'): Promise<void> {
  await prisma.blog_posts.update({
    where: { id: BigInt(id) },
    data: {
      status,
      updated_at: new Date(),
    },
  })
  revalidatePath('/posts')
}
