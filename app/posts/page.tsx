import Link from 'next/link'
import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getPosts, getCategories } from '@/app/actions/posts'
import { getProvinces } from '@/app/actions/dashboard'
import PostsTable from '@/app/components/posts/PostsTable'
import AppAlert from '@/app/components/AppAlert'
import { getSessionUser } from '@/app/lib/session'
import { prisma } from '@/app/lib/prisma'
import { parseTablePageSize } from '@/app/lib/table-pagination'
import { getNonAdminReportingWindowDecision } from '@/app/lib/operator-reporting-window'

type SearchParams = Promise<{ search?: string; category?: string; page?: string; pageSize?: string; dateFrom?: string; dateTo?: string; sort?: string; jenis?: string; status?: string; provinceId?: string; cityId?: string }>

function getJakartaDateString(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

export default async function PostsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const page = parseInt(params.page ?? '1', 10)
  const pageSize = parseTablePageSize(params.pageSize, 10)
  const sessionUser = await getSessionUser()
  if (!sessionUser) redirect('/login')
  const isAdmin = sessionUser.roles.includes('admin')
  const isManager = sessionUser.roles.includes('manager')
  const isOperator = !isAdmin && !isManager
  if (isOperator) redirect('/posts/upload')
  const canVerify = isAdmin || isManager
  const sortOrder = (params.sort === 'asc' ? 'asc' : 'desc') as 'asc' | 'desc'
  const reportingWindowDecision = await getNonAdminReportingWindowDecision(sessionUser.roles)
  const reportingWindowClosed = !reportingWindowDecision.allowed
  const today = getJakartaDateString()
  const dateFrom = params.dateFrom ?? today
  const dateTo = params.dateTo ?? today

  // Manager: scope to their tenant
  let tenantId: string | undefined
  if (isManager && !isAdmin && sessionUser) {
    const tu = await prisma.tenant_user.findFirst({
      where: { user_id: BigInt(sessionUser.id) },
      select: { tenant_id: true },
    })
    tenantId = tu?.tenant_id?.toString()
  }

  const [{ posts, total }, categories, provinces] = await Promise.all([
    getPosts({
      search: params.search,
      categoryId: params.category,
      status: params.status === 'pending' || params.status === 'valid' || params.status === 'invalid'
        ? params.status
        : undefined,
      page,
      pageSize,
      userId: isAdmin || isManager ? undefined : sessionUser?.id,
      tenantId,
      dateFrom,
      dateTo,
      sortOrder,
      postType: (params.jenis === 'upload' || params.jenis === 'amplifikasi') ? params.jenis : undefined,
      provinceId: isAdmin ? params.provinceId : undefined,
      cityId: isAdmin ? params.cityId : undefined,
    }),
    getCategories(),
    isAdmin ? getProvinces() : Promise.resolve([]),
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
            reportingWindowClosed ? (
              <span
                aria-disabled="true"
                title={reportingWindowDecision.message ?? 'Pelaporan sedang ditutup.'}
                className="cursor-not-allowed rounded-lg bg-neutral-200 px-4 py-2.5 text-sm font-semibold text-neutral-500 dark:bg-neutral-800 dark:text-neutral-500"
              >
                + Buat Laporan
              </span>
            ) : (
              <Link
                href="/posts/new"
                className="px-4 py-2.5 rounded-lg bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-sm font-semibold hover:bg-neutral-700 dark:hover:bg-neutral-100 transition"
              >
                + Buat Laporan
              </Link>
            )
          )}
        </div>

        {reportingWindowClosed && (
          <AppAlert
            type="error"
            title="Validasi Pelaporan Ditutup"
            message={reportingWindowDecision.message}
          />
        )}

        {/* Table */}
        <Suspense
          fallback={
            <div className="h-64 flex items-center justify-center text-neutral-500">
              Memuat...
            </div>
          }
        >
          <PostsTable posts={posts} total={total} categories={categories} page={page} pageSize={pageSize} isAdmin={isAdmin} canVerify={canVerify} basePath="/posts" provinces={isAdmin ? provinces : undefined} defaultDateFrom={dateFrom} defaultDateTo={dateTo} createDisabled={reportingWindowClosed} createDisabledMessage={reportingWindowDecision.message} actionsDisabled={reportingWindowClosed} actionsDisabledMessage={reportingWindowDecision.message} />
        </Suspense>
      </div>
    </div>
  )
}
