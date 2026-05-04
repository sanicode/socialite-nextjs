export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { prisma } from '@/app/lib/prisma'
import { getSessionUser } from '@/app/lib/session'
import { canActorAccessTenant } from '@/app/lib/tenant-access'
import { getNonAdminReportingWindowDecision } from '@/app/lib/operator-reporting-window'
import AppAlert from '@/app/components/AppAlert'
import UserPostsTableClient from './[status]/UserPostsTableClient'

type PostStatus = 'pending' | 'valid' | 'invalid'

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

export default async function UserPostsReviewPage({
  params,
}: {
  params: Promise<{ userId: string }>
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

  const today = getJakartaDateString()
  const dateFrom = today
  const dateTo = today
  const reportingWindowDecision = await getNonAdminReportingWindowDecision(actor.roles)
  const reportingWindowClosed = !reportingWindowDecision.allowed

  const posts = await prisma.blog_posts.findMany({
    where: {
      user_id: targetUser.id,
      source_url: { in: ['upload', 'amplifikasi'] },
      created_at: {
        gte: getJakartaDateBounds(dateFrom, false),
        lte: getJakartaDateBounds(dateTo, true),
      },
    },
    orderBy: { created_at: 'desc' },
    include: { blog_post_categories: true },
  })

  const uploadCount = posts.filter((post) => post.source_url === 'upload').length
  const amplifikasiCount = posts.filter((post) => post.source_url === 'amplifikasi').length
  const validationReady = uploadCount >= 3 && amplifikasiCount >= 3

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
    custom_properties: unknown
    order_column?: number | null
  }>>((acc, item) => {
    const id = item.model_id.toString()
    if (!acc[id]) {
      acc[id] = {
        model_id: item.model_id.toString(),
        file_name: item.file_name,
        custom_properties: item.custom_properties,
        order_column: item.order_column,
      }
    }
    return acc
  }, {})

  const serializedPosts = posts.map((post) => ({
    id: post.id.toString(),
    title: post.title,
    created_at: post.created_at?.toISOString() ?? null,
    source_url: post.source_url,
    status: post.status as PostStatus,
    blog_post_categories: post.blog_post_categories ? { name: post.blog_post_categories.name } : null,
  }))

  return (
    <div className="min-h-screen bg-[var(--background)] px-4 py-5 sm:p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/posts/users" className="text-sm text-neutral-500 transition hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white">
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
              {validationReady ? 'Terpenuhi' : 'Minimal 3 upload dan 3 amplifikasi'}
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
            message="Status laporan akan tetap pending sampai operator memiliki minimal 3 laporan upload dan 3 laporan amplifikasi pada rentang tanggal ini."
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
            validationDisabledMessage="Validasi aktif setelah minimal 3 upload dan 3 amplifikasi terpenuhi."
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
