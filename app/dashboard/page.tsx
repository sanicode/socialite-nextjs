import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getSessionUser } from '@/app/lib/session'
import { prisma } from '@/app/lib/prisma'
import {
  getProvinces,
  getDashboardStats,
  getProvinceChartData,
  getTopCitiesByPosts,
  getReportData,
  getPostsByDate,
} from '@/app/actions/dashboard'
import DashboardFilters from '@/app/components/dashboard/DashboardFilters'
import StatCards from '@/app/components/dashboard/StatCards'
import ProvinceDonutChart from '@/app/components/dashboard/ProvinceDonutChart'
import CityBarChart from '@/app/components/dashboard/CityBarChart'
import DailyPostsChart from '@/app/components/dashboard/DailyPostsChart'
import ReportTable from '@/app/components/dashboard/ReportTable'

type Props = {
  searchParams: Promise<{
    dateFrom?: string
    dateTo?: string
    provinceId?: string
    cityId?: string
  }>
}

export default async function DashboardPage({ searchParams }: Props) {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const isAdmin = user.roles.includes('admin')
  const isManager = user.roles.includes('manager')
  if (!isAdmin && !isManager) {
    redirect('/posts')
  }

  // Manager: scope data to their tenant
  let tenantId: string | undefined
  if (isManager && !isAdmin) {
    const tu = await prisma.tenant_user.findFirst({
      where: { user_id: BigInt(user.id) },
      select: { tenant_id: true },
    })
    tenantId = tu?.tenant_id?.toString()
  }

  const params = await searchParams

  const today = new Date().toISOString().slice(0, 10)

  // Default to today if no date params supplied
  const rawFrom = params.dateFrom ?? today
  const rawTo = params.dateTo ?? today

  // Server-side guard: clamp range to max 1 month
  const fromDate = new Date(rawFrom)
  const maxToDate = new Date(fromDate)
  maxToDate.setMonth(maxToDate.getMonth() + 1)
  const toDate = new Date(rawTo)
  const clampedTo = toDate > maxToDate ? maxToDate.toISOString().slice(0, 10) : rawTo

  const filters = {
    dateFrom: rawFrom,
    dateTo: clampedTo,
    provinceId: params.provinceId,
    cityId: params.cityId,
    tenantId,
  }

  const [provinces, stats, provinceData, cityData, reportData, dailyData] = await Promise.all([
    getProvinces(),
    getDashboardStats(filters),
    isAdmin ? getProvinceChartData(filters) : Promise.resolve([]),
    isAdmin ? getTopCitiesByPosts(filters) : Promise.resolve([] as Awaited<ReturnType<typeof getTopCitiesByPosts>>),
    isAdmin ? getReportData(filters) : Promise.resolve([]),
    getPostsByDate(filters),
  ])

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">Dashboard</h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
            Ringkasan data pelaporan upload media sosial
          </p>
        </div>

        <Suspense fallback={null}>
          <DashboardFilters
            provinces={provinces}
            isAdmin={isAdmin}
            defaultDateFrom={rawFrom}
            defaultDateTo={clampedTo}
          />
        </Suspense>

        <StatCards stats={stats} />

        {isAdmin && (
          <>
            <ProvinceDonutChart data={provinceData} />

            <CityBarChart data={cityData} />

            <DailyPostsChart data={dailyData} />

            <ReportTable data={reportData} />
          </>
        )}

        {!isAdmin && <DailyPostsChart data={dailyData} />}
      </div>
    </div>
  )
}
