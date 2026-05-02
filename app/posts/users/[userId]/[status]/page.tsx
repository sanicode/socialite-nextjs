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
import type { Prisma } from '@/app/generated/prisma/client'

type SearchParams = Promise<{
  jenis?: string
  category?: string
  dateFrom?: string
  dateTo?: string
}>

type PostStatus = 'pending' | 'valid' | 'invalid'

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

  const where: Prisma.blog_postsWhereInput = {
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
  type MediaRow = Awaited<ReturnType<typeof prisma.media.findMany>>[number]
  let mediaByPostId: Record<string, MediaRow> = {}
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
    }, {} as Record<string, MediaRow>)
  }

  const serializedCategories = categories.map((item) => ({
    id: item.id.toString(),
    name: item.name,
  }))
  const serializedPosts = posts.map((post) => ({
    id: post.id.toString(),
    title: post.title,
    created_at: post.created_at?.toISOString() ?? null,
    source_url: post.source_url,
    status: post.status as PostStatus,
    blog_post_categories: post.blog_post_categories ? { name: post.blog_post_categories.name } : null,
  }))
  const serializedMediaByPostId = Object.fromEntries(
    Object.entries(mediaByPostId).map(([id, media]) => [
      id,
      {
        model_id: media.model_id.toString(),
        file_name: media.file_name,
        custom_properties: media.custom_properties,
        order_column: media.order_column,
      },
    ])
  )
  const serializedUserData = {
    name: userData.name,
  }

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
          categories={serializedCategories}
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
            posts={serializedPosts}
            mediaByPostId={serializedMediaByPostId}
            userData={serializedUserData}
            status={status}
            validationEnabled={user.roles.includes('admin')}
            validationDisabledMessage="Validasi manager dilakukan dari halaman View operator."
            actionsDisabled={reportingWindowClosed}
            actionsDisabledMessage={reportingWindowDecision.message}
          />
        </div>

      </div>
    </div>
  )
}
