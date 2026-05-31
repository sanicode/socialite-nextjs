'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/app/lib/authorization'
import { prisma } from '@/app/lib/prisma'
import { logEvent } from '@/app/lib/logger'
import { Prisma } from '@/app/generated/prisma/client'
import type { TablePageSize } from '@/app/lib/table-pagination'
import { normalizeSocialUrlRules, type SocialUrlRules } from '@/app/lib/social-platform'

const SETTINGS_PATH = '/settings/jenis-medsos'

export type SocialMediaCategoryRow = {
  id: string
  name: string
  slug: string
  is_active: boolean
  is_required: boolean
  url_rules: SocialUrlRules | null
  created_at: string | null
  updated_at: string | null
}

export type SocialMediaCategoryFormData = {
  name: string
  slug?: string
  is_active: boolean
  is_required: boolean
  url_rules?: SocialUrlRules | null
}

export type GetSocialMediaCategoriesResult = {
  categories: SocialMediaCategoryRow[]
  total: number
  totalActive: number
  totalInactive: number
  totalRequired: number
}

function serializeCategory(category: {
  id: bigint
  name: string
  slug: string
  is_active: boolean
  is_required: boolean
  url_rules: unknown | null
  created_at: Date | null
  updated_at: Date | null
}): SocialMediaCategoryRow {
  return {
    id: category.id.toString(),
    name: category.name,
    slug: category.slug,
    is_active: category.is_active,
    is_required: category.is_required,
    url_rules: normalizeSocialUrlRules(category.url_rules),
    created_at: category.created_at?.toISOString() ?? null,
    updated_at: category.updated_at?.toISOString() ?? null,
  }
}

function parseCategoryId(categoryId: string) {
  if (!/^\d+$/.test(categoryId)) throw new Error('ID jenis medsos tidak valid.')
  return BigInt(categoryId)
}

function parseDateBound(value: string | undefined, endOfDay: boolean) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined
  return new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}+07:00`)
}

function slugify(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function cleanCategoryFormData(data: SocialMediaCategoryFormData) {
  const name = data.name.trim()
  if (!name) throw new Error('Nama jenis medsos wajib diisi.')
  if (name.length > 255) throw new Error('Nama jenis medsos maksimal 255 karakter.')

  const slug = slugify(data.slug?.trim() || name)
  if (!slug) throw new Error('Slug wajib diisi.')
  if (slug.length > 255) throw new Error('Slug maksimal 255 karakter.')

  const urlRules = data.url_rules ? normalizeSocialUrlRules(data.url_rules) : null
  if (data.url_rules && (!urlRules || urlRules.hosts.length === 0)) {
    throw new Error('Minimal satu domain URL valid wajib diisi.')
  }

  return {
    name,
    slug,
    is_active: Boolean(data.is_active),
    is_required: Boolean(data.is_required),
    url_rules: urlRules,
  }
}

function toPrismaUrlRulesInput(rules: SocialUrlRules | null): Prisma.InputJsonValue | typeof Prisma.DbNull {
  if (!rules) return Prisma.DbNull
  return {
    hosts: rules.hosts,
    ...(rules.placeholder ? { placeholder: rules.placeholder } : {}),
    required: rules.required ?? true,
  }
}

async function ensureUniqueSlug(slug: string, exceptId?: bigint) {
  const existing = await prisma.blog_post_categories.findUnique({
    where: { slug },
    select: { id: true },
  })
  if (existing && existing.id !== exceptId) {
    throw new Error('Slug sudah digunakan jenis medsos lain.')
  }
}

function revalidateCategoryPaths() {
  revalidatePath(SETTINGS_PATH)
  revalidatePath('/posts')
  revalidatePath('/posts/new')
  revalidatePath('/posts/upload')
  revalidatePath('/posts/upload/new')
  revalidatePath('/posts/amplifikasi')
  revalidatePath('/posts/amplifikasi/new')
  revalidatePath('/posts/social-media')
}

export async function getSocialMediaCategories(params: {
  page?: number
  pageSize?: TablePageSize
  search?: string
  status?: string
  required?: string
  createdFrom?: string
  createdTo?: string
  updatedFrom?: string
  updatedTo?: string
  sortBy?: string
  sortDir?: string
} = {}): Promise<GetSocialMediaCategoriesResult> {
  await requireAdmin()

  const page = params.page ?? 1
  const pageSize = params.pageSize ?? 20
  const skip = pageSize === 'all' ? undefined : (page - 1) * pageSize
  const take = pageSize === 'all' ? undefined : pageSize
  const createdFrom = parseDateBound(params.createdFrom, false)
  const createdTo = parseDateBound(params.createdTo, true)
  const updatedFrom = parseDateBound(params.updatedFrom, false)
  const updatedTo = parseDateBound(params.updatedTo, true)

  const where: Prisma.blog_post_categoriesWhereInput = {
    deleted_at: null,
    ...(params.search
      ? {
          OR: [
            { name: { contains: params.search, mode: 'insensitive' } },
            { slug: { contains: params.search, mode: 'insensitive' } },
          ],
        }
      : {}),
    ...(params.status === 'active' ? { is_active: true } : {}),
    ...(params.status === 'inactive' ? { is_active: false } : {}),
    ...(params.required === 'true' ? { is_required: true } : {}),
    ...(params.required === 'false' ? { is_required: false } : {}),
    ...((createdFrom || createdTo)
      ? { created_at: { ...(createdFrom ? { gte: createdFrom } : {}), ...(createdTo ? { lte: createdTo } : {}) } }
      : {}),
    ...((updatedFrom || updatedTo)
      ? { updated_at: { ...(updatedFrom ? { gte: updatedFrom } : {}), ...(updatedTo ? { lte: updatedTo } : {}) } }
      : {}),
  }

  const sortDir = params.sortDir === 'desc' ? 'desc' : 'asc'
  const orderBy: Prisma.blog_post_categoriesOrderByWithRelationInput = (() => {
    switch (params.sortBy) {
      case 'slug':
        return { slug: sortDir }
      case 'is_active':
        return { is_active: sortDir }
      case 'is_required':
        return { is_required: sortDir }
      case 'created_at':
        return { created_at: sortDir }
      case 'updated_at':
        return { updated_at: sortDir }
      default:
        return { name: sortDir }
    }
  })()

  const [categories, total, totalActive, totalInactive, totalRequired] = await Promise.all([
    prisma.blog_post_categories.findMany({
      where,
      orderBy,
      skip,
      take,
    }),
    prisma.blog_post_categories.count({ where }),
    prisma.blog_post_categories.count({ where: { deleted_at: null, is_active: true } }),
    prisma.blog_post_categories.count({ where: { deleted_at: null, is_active: false } }),
    prisma.blog_post_categories.count({ where: { deleted_at: null, is_active: true, is_required: true } }),
  ])

  return {
    categories: categories.map(serializeCategory),
    total,
    totalActive,
    totalInactive,
    totalRequired,
  }
}

export async function createSocialMediaCategory(data: SocialMediaCategoryFormData): Promise<void> {
  const admin = await requireAdmin()

  const cleaned = cleanCategoryFormData(data)
  await ensureUniqueSlug(cleaned.slug)

  const category = await prisma.blog_post_categories.create({
    data: {
      name: cleaned.name,
      slug: cleaned.slug,
      is_active: cleaned.is_active,
      is_required: cleaned.is_required,
      url_rules: toPrismaUrlRulesInput(cleaned.url_rules),
      created_at: new Date(),
      updated_at: new Date(),
    },
  })

  logEvent('info', 'social_media_category.created', {
    adminId: admin.id,
    categoryId: category.id.toString(),
  })
  revalidateCategoryPaths()
}

export async function updateSocialMediaCategory(
  categoryId: string,
  data: SocialMediaCategoryFormData
): Promise<void> {
  const admin = await requireAdmin()

  const id = parseCategoryId(categoryId)
  const existing = await prisma.blog_post_categories.findUnique({
    where: { id },
    select: { id: true, deleted_at: true },
  })
  if (!existing || existing.deleted_at) throw new Error('Jenis medsos tidak ditemukan.')

  const cleaned = cleanCategoryFormData(data)
  await ensureUniqueSlug(cleaned.slug, id)

  await prisma.blog_post_categories.update({
    where: { id },
    data: {
      name: cleaned.name,
      slug: cleaned.slug,
      is_active: cleaned.is_active,
      is_required: cleaned.is_required,
      url_rules: toPrismaUrlRulesInput(cleaned.url_rules),
      updated_at: new Date(),
    },
  })

  logEvent('info', 'social_media_category.updated', {
    adminId: admin.id,
    categoryId,
  })
  revalidateCategoryPaths()
}

export async function setSocialMediaCategoryActive(
  categoryId: string,
  isActive: boolean
): Promise<void> {
  const admin = await requireAdmin()

  const id = parseCategoryId(categoryId)
  const result = await prisma.blog_post_categories.updateMany({
    where: { id, deleted_at: null },
    data: {
      is_active: isActive,
      updated_at: new Date(),
    },
  })
  if (result.count === 0) throw new Error('Jenis medsos tidak ditemukan.')

  logEvent('info', 'social_media_category.status_updated', {
    adminId: admin.id,
    categoryId,
    isActive,
  })
  revalidateCategoryPaths()
}

export async function deleteSocialMediaCategory(categoryId: string): Promise<void> {
  const admin = await requireAdmin()

  const id = parseCategoryId(categoryId)
  const result = await prisma.blog_post_categories.updateMany({
    where: { id, deleted_at: null },
    data: {
      is_active: false,
      deleted_at: new Date(),
      updated_at: new Date(),
    },
  })
  if (result.count === 0) throw new Error('Jenis medsos tidak ditemukan.')

  logEvent('warn', 'social_media_category.deleted', {
    adminId: admin.id,
    categoryId,
  })
  revalidateCategoryPaths()
}
