export const dynamic = 'force-dynamic'

import { getSessionUser } from '@/app/lib/session'
import { redirect } from 'next/navigation'
import { prisma } from '@/app/lib/prisma'
import Link from 'next/link'
import UserPostsTableClient from './UserPostsTableClient'
import UserPostsFilterClient from './UserPostsFilterClient'
import AppAlert from '@/app/components/AppAlert'
import { getNonAdminReportingWindowDecision } from '@/app/lib/operator-reporting-window'
import { canActorAccessTenant } from '@/app/lib/tenant-access'

type SearchParams = Promise<{
  jenis?: string
  category?: string
  dateFrom?: string
  dateTo?: string
}>

export default async function UserPostsByStatusPage({
  params,
  searchParams,
}: {
  params: Promise<{ userId: string; status: string }>
  searchParams: SearchParams
}) {
  const user = await getSessionUser()
  if (!user) redirect('/login')
  if (!user.roles.some(role => ['admin', 'manager'].includes(role))) redirect('/posts/upload')

  const { userId, status } = await params
  const { jenis, category, dateFrom, dateTo } = await searchParams
  const reportingWindowDecision = await getNonAdminReportingWindowDecision(user.roles)
  const reportingWindowClosed = !reportingWindowDecision.allowed

  if (!userId || isNaN(Number(userId))) {
    return <div className="min-h-screen bg-[var(--background)] px-4 py-5 sm:p-6 text-neutral-500">User ID tidak valid</div>
  }

  const userData = await prisma.users.findUnique({ where: { id: BigInt(userId) } })
  if (!userData) {
    return <div className="min-h-screen bg-[var(--background)] px-4 py-5 sm:p-6 text-neutral-500">User tidak ditemukan</div>
  }

  if (!user.roles.includes('admin')) {
    const targetTenantUser = await prisma.tenant_user.findFirst({
      where: { user_id: userData.id },
      select: { tenant_id: true },
    })
    const canAccessTarget = await canActorAccessTenant(user, targetTenantUser?.tenant_id.toString() ?? null)
    if (!canAccessTarget) redirect('/posts/users')
  }

  const categories = await prisma.blog_post_categories.findMany({ orderBy: { name: 'asc' } })

  const where: Record<string, any> = {
    user_id: userData.id,
    status,
    ...(jenis === 'upload' || jenis === 'amplifikasi' ? { source_url: jenis } : {}),
    ...(category ? { blog_post_category_id: BigInt(category) } : {}),
    ...(dateFrom || dateTo ? {
      created_at: {
        ...(dateFrom ? { gte: new Date(dateFrom + 'T00:00:00') } : {}),
        ...(dateTo   ? { lte: new Date(dateTo   + 'T23:59:59') } : {}),
      },
    } : {}),
  }

  const posts = await prisma.blog_posts.findMany({
    where,
    orderBy: { created_at: 'desc' },
    include: { blog_post_categories: true },
  })

  const postIds = posts.map((p) => p.id)
  let mediaByPostId: Record<string, any> = {}
  if (postIds.length > 0) {
    const media = await prisma.media.findMany({
      where: {
        model_type: 'App\\Models\\BlogPost',
        collection_name: 'blog-images',
        model_id: { in: postIds },
      },
      orderBy: { order_column: 'asc' },
    })
    mediaByPostId = media.reduce((acc, m) => {
      const id = m.model_id.toString()
      if (!acc[id]) acc[id] = m
      return acc
    }, {} as Record<string, any>)
  }

  const serialize = (data: any) => JSON.parse(JSON.stringify(data, (_, v) =>
    typeof v === 'bigint' ? v.toString() : v
  ))

  return (
    <div className="min-h-screen bg-[var(--background)] px-4 py-5 sm:p-6">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <Link
            href="/posts/users"
            className="text-sm text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition"
          >
            ← Kembali
          </Link>
          <span className="text-neutral-300 dark:text-neutral-700">/</span>
          <h1 className="text-xl font-bold text-neutral-900 dark:text-white capitalize">
            Laporan {status} — {userData.name}
          </h1>
        </div>

        {/* Filter */}
        <UserPostsFilterClient
          categories={serialize(categories)}
          jenis={jenis ?? ''}
          category={category ?? ''}
          dateFrom={dateFrom ?? ''}
          dateTo={dateTo ?? ''}
        />

        {/* Jumlah hasil */}
        <p className="text-sm text-neutral-500 dark:text-neutral-400 -mt-2">
          {posts.length} laporan ditemukan
        </p>

        {reportingWindowClosed && (
          <AppAlert
            type="error"
            title="Validasi Pelaporan Ditutup"
            message={reportingWindowDecision.message}
          />
        )}

        {/* Table */}
        <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
          <UserPostsTableClient
            key={`${jenis}-${category}-${dateFrom}-${dateTo}`}
            posts={serialize(posts)}
            mediaByPostId={serialize(mediaByPostId)}
            userData={serialize(userData)}
            status={status}
            actionsDisabled={reportingWindowClosed}
            actionsDisabledMessage={reportingWindowDecision.message}
          />
        </div>

      </div>
    </div>
  )
}
