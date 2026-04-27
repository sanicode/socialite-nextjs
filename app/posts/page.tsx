import Link from 'next/link'
import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getPosts, getCategories } from '@/app/actions/posts'
import PostsTable from '@/app/components/posts/PostsTable'
import { getSessionUser } from '@/app/lib/session'
import { prisma } from '@/app/lib/prisma'

type SearchParams = Promise<{ search?: string; category?: string; page?: string; dateFrom?: string; dateTo?: string; sort?: string; jenis?: string; status?: string }>

export default async function PostsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const page = parseInt(params.page ?? '1', 10)
  const sessionUser = await getSessionUser()
  if (!sessionUser) redirect('/login')
  const isAdmin = sessionUser.roles.includes('admin')
  const isManager = sessionUser.roles.includes('manager')
  const isOperator = !isAdmin && !isManager
  if (isOperator) redirect('/posts/upload')
  const canVerify = isAdmin || isManager
  const sortOrder = (params.sort === 'asc' ? 'asc' : 'desc') as 'asc' | 'desc'

  // Manager: scope to their tenant
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
      status: params.status === 'pending' || params.status === 'valid' || params.status === 'invalid'
        ? params.status
        : undefined,
      page,
      userId: isAdmin || isManager ? undefined : sessionUser?.id,
      tenantId,
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
      sortOrder,
      postType: (params.jenis === 'upload' || params.jenis === 'amplifikasi') ? params.jenis : undefined,
    }),
    getCategories(),
  ])

  return (
    <div className="min-h-screen bg-[var(--background)] px-4 py-5 sm:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">
              Pelaporan
            </h1>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
              {total} post terdaftar
            </p>
          </div>
          {(!isManager || isAdmin) && (
            <Link
              href="/posts/new"
              className="px-4 py-2.5 rounded-lg bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-sm font-semibold hover:bg-neutral-700 dark:hover:bg-neutral-100 transition"
            >
              + Buat Laporan
            </Link>
          )}
        </div>

        {/* Table */}
        <Suspense
          fallback={
            <div className="h-64 flex items-center justify-center text-neutral-500">
              Memuat...
            </div>
          }
        >
          <PostsTable posts={posts} total={total} categories={categories} page={page} isAdmin={isAdmin} canVerify={canVerify} basePath="/posts" />
        </Suspense>
      </div>
    </div>
  )
}
