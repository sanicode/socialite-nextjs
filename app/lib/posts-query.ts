import { prisma } from '@/app/lib/prisma'
import { getMediaUrl } from '@/app/lib/s3'
import type { TablePageSize } from '@/app/lib/table-pagination'

export type QueryPost = {
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

export type QueryPostsParams = {
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
}

function getS3Key(media: { file_name: string; custom_properties: unknown }): string {
  const props = media.custom_properties as Record<string, unknown> | null
  if (props && typeof props.object_key === 'string') return props.object_key
  return media.file_name
}

function getJakartaDateBounds(dateString: string, endOfDay: boolean) {
  return new Date(`${dateString}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}+07:00`)
}

export async function queryPosts(params: QueryPostsParams): Promise<{ posts: QueryPost[]; total: number }> {
  const {
    search,
    categoryId,
    status,
    page = 1,
    pageSize = 10,
    userId,
    tenantId,
    tenantIds,
    dateFrom,
    dateTo,
    sortOrder = 'desc',
    postType,
    provinceId,
    cityId,
  } = params
  const skip = pageSize === 'all' ? undefined : (page - 1) * pageSize
  const take = pageSize === 'all' ? undefined : pageSize

  let userIdFilter: { user_id: bigint } | { user_id: { in: bigint[] } } | undefined
  const tenantScope = tenantId ? [tenantId] : tenantIds
  if (tenantScope?.length) {
    const tenantUsers = await prisma.tenant_user.findMany({
      where: { tenant_id: { in: tenantScope.map((id) => BigInt(id)) } },
      select: { user_id: true },
    })
    const tenantUserIds = tenantUsers.map((tu) => tu.user_id)
    userIdFilter = userId
      ? { user_id: { in: tenantUserIds.filter((id) => id === BigInt(userId)) } }
      : { user_id: { in: tenantUserIds } }
  } else if (userId) {
    userIdFilter = { user_id: BigInt(userId) }
  }

  let provinceCityTenantFilter: { tenant_id: { in: bigint[] } } | undefined
  if (provinceId || cityId) {
    const conditions: string[] = ['a.tenant_id IS NOT NULL']
    const queryParams: unknown[] = []
    let idx = 1

    if (provinceId) {
      conditions.push(`c.province_id = $${idx}`)
      queryParams.push(parseInt(provinceId, 10))
      idx++
    }

    if (cityId) {
      conditions.push(`a.city_id = $${idx}`)
      queryParams.push(parseInt(cityId, 10))
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
    if (matchingTenantIds.length === 0) return { posts: [], total: 0 }
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
    ...(categoryId && { blog_post_category_id: BigInt(categoryId) }),
    ...(status && { status }),
    ...((dateFrom || dateTo) && {
      created_at: {
        ...(dateFrom && { gte: getJakartaDateBounds(dateFrom, false) }),
        ...(dateTo && { lte: getJakartaDateBounds(dateTo, true) }),
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

  const userIds = [...new Set(posts.map((p) => p.user_id))]
  const tenantUsers = userIds.length
    ? await prisma.tenant_user.findMany({
        where: { user_id: { in: userIds } },
        select: { user_id: true, tenant_id: true },
      })
    : []

  const tenantIdByUserId = new Map(tenantUsers.map((tu) => [tu.user_id.toString(), tu.tenant_id]))
  const tenantIdsForAddress = [...new Set(tenantUsers.map((tu) => tu.tenant_id))]
  const addressList = tenantIdsForAddress.length
    ? await prisma.addresses.findMany({
        where: { tenant_id: { in: tenantIdsForAddress } },
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
      const postTenantId = p.tenant_id?.toString() ?? tenantIdByUserId.get(p.user_id.toString())?.toString()
      const address = postTenantId ? addressByTenantId.get(postTenantId) : null
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
          ? { id: p.blog_post_categories.id.toString(), name: p.blog_post_categories.name }
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

export async function queryPostById(id: string): Promise<QueryPost | null> {
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
      select: { city_id: true },
    })
    if (address?.city_id) {
      const city = await prisma.reg_cities.findUnique({
        where: { id: BigInt(address.city_id) },
        select: { name: true, province_id: true },
      })
      cityName = city?.name ?? null
      if (city) {
        const province = await prisma.reg_provinces.findUnique({ where: { id: city.province_id } })
        provinceName = province?.name ?? null
      }
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
    source_url: post.source_url ?? null,
    tenant_id: post.tenant_id?.toString() ?? null,
  }
}
