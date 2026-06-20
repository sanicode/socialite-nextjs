export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { prisma } from '@/app/lib/prisma'
import { getSessionUser } from '@/app/lib/session'
import { canActorAccessTenant } from '@/app/lib/tenant-access'
import { getNonAdminReportingWindowDecision } from '@/app/lib/operator-reporting-window'
import AppAlert from '@/app/components/AppAlert'
import UserPostsTableClient from './[status]/UserPostsTableClient'
import { getStoredMediaUrl } from '@/app/lib/s3'
import {
  getOperatorReportValidationDisabledMessage,
  getOperatorReportValidationPendingMessage,
  getRequiredSocialMediaCategoryCount,
  isOperatorReportValidationReady,
} from '@/app/lib/operator-report-validation'

type PostStatus = 'pending' | 'valid' | 'invalid'
type SearchParams = Promise<{
  dateFrom?: string
  dateTo?: string
  search?: string
  provinceId?: string
  cityId?: string
}>

function getJakartaDateString(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function getJakartaDateBounds(dateString: string, endOfDay: boolean) {
  return new Date(`${dateString}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}+07:00`)
}

function normalizeDateParam(value: string | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined
  const parsed = new Date(`${value}T00:00:00+07:00`)
  if (Number.isNaN(parsed.getTime())) return undefined
  return getJakartaDateString(parsed) === value ? value : undefined
}

function buildPostsUsersHref(params: Record<string, string | undefined>) {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value) query.set(key, value)
  }
  const qs = query.toString()
  return qs ? `/posts/users?${qs}` : '/posts/users'
}

export default async function UserPostsReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ userId: string }>
  searchParams: SearchParams
}) {
  const actor = await getSessionUser()
  if (!actor) redirect('/login')
  if (!actor.roles.some((role) => ['admin', 'manager'].includes(role))) redirect('/posts/upload')

  const { userId } = await params
  if (!userId || !/^\d+$/.test(userId)) {
    return <div className="min-h-screen bg-[var(--background)] px-4 py-5 text-neutral-500 sm:p-6">User ID tidak valid</div>
  }

  const targetUser = await prisma.users.findUnique({ where: { id: BigInt(userId) } })
  if (!targetUser) {
    return <div className="min-h-screen bg-[var(--background)] px-4 py-5 text-neutral-500 sm:p-6">User tidak ditemukan</div>
  }

  const targetTenantUser = await prisma.tenant_user.findFirst({
    where: { user_id: targetUser.id },
    select: { tenant_id: true },
  })
  if (!actor.roles.includes('admin')) {
    const canAccessTarget = await canActorAccessTenant(actor, targetTenantUser?.tenant_id.toString() ?? null)
    if (!canAccessTarget) redirect('/posts/users')
  }

  const { dateFrom: rawDateFrom, dateTo: rawDateTo, search, provinceId, cityId } = await searchParams
  const today = getJakartaDateString()
  const requestedDateFrom = normalizeDateParam(rawDateFrom)
  const requestedDateTo = normalizeDateParam(rawDateTo)
  const hasDateFilter = !!(requestedDateFrom || requestedDateTo)
  const dateFrom = hasDateFilter ? requestedDateFrom ?? '' : today
  const dateTo = hasDateFilter ? requestedDateTo ?? '' : today
  const reportingWindowDecision = await getNonAdminReportingWindowDecision(actor.roles)
  const reportingWindowClosed = !reportingWindowDecision.allowed

  const [posts, requiredCategoryCount] = await Promise.all([
    prisma.blog_posts.findMany({
      where: {
        user_id: targetUser.id,
        source_url: { in: ['upload', 'amplifikasi'] },
        created_at: {
          ...(dateFrom ? { gte: getJakartaDateBounds(dateFrom, false) } : {}),
          ...(dateTo ? { lte: getJakartaDateBounds(dateTo, true) } : {}),
        },
      },
      orderBy: { created_at: 'desc' },
      include: { blog_post_categories: true },
    }),
    getRequiredSocialMediaCategoryCount(),
  ])

  const uploadCount = posts.filter((post) => post.source_url === 'upload').length
  const amplifikasiCount = posts.filter((post) => post.source_url === 'amplifikasi').length
  const validationReady = isOperatorReportValidationReady(uploadCount, amplifikasiCount, requiredCategoryCount)

  const postIds = posts.map((post) => post.id)
  const media = postIds.length > 0
    ? await prisma.media.findMany({
        where: {
          model_type: 'App\\Models\\BlogPost',
          collection_name: 'blog-images',
          model_id: { in: postIds },
        },
        orderBy: { order_column: 'asc' },
      })
    : []
  const mediaByPostId = media.reduce<Record<string, {
    model_id: string
    file_name: string
    url: string
    order_column?: number | null
  }>>((acc, item) => {
    const id = item.model_id.toString()
    if (!acc[id]) {
      acc[id] = {
        model_id: item.model_id.toString(),
        file_name: item.file_name,
        url: getStoredMediaUrl(item),
        order_column: item.order_column,
      }
    }
    return acc
  }, {})

  const serializedPosts = posts.map((post) => ({
    id: post.id.toString(),
    title: post.title,
    description: post.description,
    created_at: post.created_at?.toISOString() ?? null,
    source_url: post.source_url,
    status: post.status as PostStatus,
    is_trending: post.is_trending,
    blog_post_categories: post.blog_post_categories ? { name: post.blog_post_categories.name } : null,
  }))

  return (
    <div className="min-h-screen bg-[var(--background)] px-4 py-5 sm:p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <Link href={buildPostsUsersHref({ dateFrom, dateTo, search, provinceId, cityId })} className="text-sm text-neutral-500 transition hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white">
            ← Kembali
          </Link>
          <span className="text-neutral-300 dark:text-neutral-700">/</span>
          <h1 className="text-xl font-bold text-neutral-900 dark:text-white">
            Review Laporan — {targetUser.name}
          </h1>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
            <p className="text-xs text-neutral-500 dark:text-neutral-400">Upload</p>
            <p className="mt-1 text-2xl font-bold text-neutral-900 dark:text-white">{uploadCount.toLocaleString('id-ID')}</p>
          </div>
          <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
            <p className="text-xs text-neutral-500 dark:text-neutral-400">Amplifikasi</p>
            <p className="mt-1 text-2xl font-bold text-neutral-900 dark:text-white">{amplifikasiCount.toLocaleString('id-ID')}</p>
          </div>
          <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
            <p className="text-xs text-neutral-500 dark:text-neutral-400">Syarat Validasi</p>
            <p className={`mt-1 text-sm font-semibold ${validationReady ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
              {validationReady ? 'Terpenuhi' : `Minimal ${requiredCategoryCount} upload dan ${requiredCategoryCount} amplifikasi`}
            </p>
          </div>
        </div>

        {reportingWindowClosed && (
          <AppAlert
            type="error"
            title="Validasi Pelaporan Ditutup"
            message={reportingWindowDecision.message}
          />
        )}

        {!validationReady && (
          <AppAlert
            type="warning"
            title="Validasi Belum Aktif"
            message={getOperatorReportValidationPendingMessage(requiredCategoryCount)}
          />
        )}

        <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
          <UserPostsTableClient
            key={`${dateFrom}-${dateTo}-${serializedPosts.length}`}
            posts={serializedPosts}
            mediaByPostId={mediaByPostId}
            userData={{ name: targetUser.name }}
            status=""
            validationEnabled={validationReady}
            validationDisabledMessage={getOperatorReportValidationDisabledMessage(requiredCategoryCount)}
            validationDateFrom={dateFrom}
            validationDateTo={dateTo}
            removeOnStatusChange={false}
            actionsDisabled={reportingWindowClosed}
            actionsDisabledMessage={reportingWindowDecision.message}
          />
        </div>
      </div>
    </div>
  )
}
