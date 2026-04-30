import Link from 'next/link'
import { Suspense } from 'react'
import { getPosts, getCategories } from '@/app/actions/posts'
import PostsTable from '@/app/components/posts/PostsTable'
import { getSessionUser } from '@/app/lib/session'
import { prisma } from '@/app/lib/prisma'
import { parseTablePageSize } from '@/app/lib/table-pagination'

type SearchParams = Promise<{ search?: string; category?: string; page?: string; pageSize?: string; dateFrom?: string; dateTo?: string; sort?: string }>

export default async function AmplifikasiPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const page = parseInt(params.page ?? '1', 10)
  const pageSize = parseTablePageSize(params.pageSize, 10)
  const sessionUser = await getSessionUser()
  const isAdmin = sessionUser?.roles.includes('admin') ?? false
  const isManager = sessionUser?.roles.includes('manager') ?? false
  const canVerify = isAdmin || isManager
  const sortOrder = (params.sort === 'asc' ? 'asc' : 'desc') as 'asc' | 'desc'

  let tenantId: string | undefined
  if (isManager && !isAdmin && sessionUser) {
    const tu = await prisma.tenant_user.findFirst({
      where: { user_id: BigInt(sessionUser.id) },
      select: { tenant_id: true },
    })
    tenantId = tu?.tenant_id?.toString()
  }

  const [{ posts, total }, categories] = await Promise.all([
    getPosts({
      search: params.search,
      categoryId: params.category,
      page,
      pageSize,
      userId: isAdmin || isManager ? undefined : sessionUser?.id,
      tenantId,
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
      sortOrder,
      postType: 'amplifikasi',
    }),
    getCategories(),
  ])

  return (
    <div className="min-h-screen bg-[var(--background)] px-4 py-5 sm:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">Pelaporan mplifikasi</h1>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">{total} laporan terdaftar</p>
          </div>
          {(!isManager || isAdmin) && (
            <Link
              href="/posts/amplifikasi/new"
              className="px-4 py-2.5 rounded-lg bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-sm font-semibold hover:bg-neutral-700 dark:hover:bg-neutral-100 transition"
            >
              + Buat Laporan Amplifikasi
            </Link>
          )}
        </div>

        <Suspense fallback={<div className="h-64 flex items-center justify-center text-neutral-500">Memuat...</div>}>
          <PostsTable
            posts={posts}
            total={total}
            categories={categories}
            page={page}
            pageSize={pageSize}
            isAdmin={isAdmin}
            canVerify={canVerify}
            basePath="/posts/amplifikasi"
            variant="amplifikasi"
          />
        </Suspense>
      </div>
    </div>
  )
}
