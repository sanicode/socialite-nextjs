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
import OperatorDailyChecklist, {
  type OperatorChecklistRow,
  type OperatorChecklistStatus,
} from '@/app/components/dashboard/OperatorDailyChecklist'
import { getOperatorReportingWindowDecision } from '@/app/lib/operator-reporting-window'

type Props = {
  searchParams: Promise<{
    dateFrom?: string
    dateTo?: string
    provinceId?: string
    cityId?: string
    tenantId?: string
    status?: string
  }>
}

type OperatorDailyPostRow = {
  id: string
  source_url: string | null
  status: string | null
  category_name: string | null
}

const OPERATOR_CHECKLIST_PLATFORMS = ['Facebook', 'TikTok', 'Instagram', 'YouTube']

function getJakartaDateString(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function formatJakartaDate(dateString: string) {
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${dateString}T00:00:00+07:00`))
}

function getPlatformName(categoryName: string | null) {
  const lower = categoryName?.toLowerCase() ?? ''
  return OPERATOR_CHECKLIST_PLATFORMS.find((platform) => lower.includes(platform.toLowerCase())) ?? null
}

function normalizeChecklistStatus(status: string | null): OperatorChecklistStatus {
  if (status === 'valid' || status === 'invalid' || status === 'pending') return status
  return 'pending'
}

function getChecklistStatusLabel(status: OperatorChecklistStatus) {
  switch (status) {
    case 'valid':
      return 'Valid'
    case 'invalid':
      return 'Invalid'
    case 'pending':
      return 'Pending'
    default:
      return 'Belum dikirim'
  }
}

function createMissingChecklistCell() {
  return {
    status: 'missing' as const,
    label: 'Belum dikirim',
    totalCount: 0,
    validCount: 0,
    pendingCount: 0,
    invalidCount: 0,
  }
}

async function getOperatorDailyChecklist(userId: string) {
  const today = getJakartaDateString()
  const posts = await prisma.$queryRawUnsafe<OperatorDailyPostRow[]>(
    `SELECT
       p.id::text AS id,
       p.source_url,
       p.status,
       c.name AS category_name
     FROM blog_posts p
     LEFT JOIN blog_post_categories c ON c.id = p.blog_post_category_id
     WHERE p.user_id = $1::bigint
       AND p.source_url IN ('upload', 'amplifikasi')
       AND date((p.created_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Jakarta') = $2::date
     ORDER BY p.created_at DESC, p.id DESC`,
    userId,
    today
  )

  const rows: OperatorChecklistRow[] = [
    {
      key: 'upload',
      label: 'Upload',
      href: '/posts/upload',
      cells: {},
    },
    {
      key: 'amplifikasi',
      label: 'Amplifikasi',
      href: '/posts/amplifikasi',
      cells: {},
    },
  ]

  const rowByType = new Map(rows.map((row) => [row.key, row]))
  for (const row of rows) {
    for (const platform of OPERATOR_CHECKLIST_PLATFORMS) {
      row.cells[platform] = createMissingChecklistCell()
    }
  }

  for (const post of posts) {
    if (post.source_url !== 'upload' && post.source_url !== 'amplifikasi') continue
    const platform = getPlatformName(post.category_name)
    if (!platform) continue

    const row = rowByType.get(post.source_url)
    if (!row) continue

    const status = normalizeChecklistStatus(post.status)
    const cell = row.cells[platform]
    cell.totalCount += 1
    cell.postId = post.id

    if (status === 'valid') {
      cell.validCount += 1
    } else if (status === 'pending') {
      cell.pendingCount += 1
    } else {
      cell.invalidCount += 1
    }

    const aggregatedStatus =
      cell.validCount > 0
        ? 'valid'
        : cell.pendingCount > 0
          ? 'pending'
          : cell.invalidCount > 0
            ? 'invalid'
            : 'missing'

    cell.status = aggregatedStatus
    cell.label = getChecklistStatusLabel(aggregatedStatus)
  }

  return {
    dateLabel: formatJakartaDate(today),
    rows,
  }
}

export default async function DashboardPage({ searchParams }: Props) {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const isAdmin = user.roles.includes('admin')
  const isManager = user.roles.includes('manager')
  const isOperator = user.roles.includes('operator')
  if (!isAdmin && !isManager && !isOperator) {
    redirect('/posts')
  }

  if (isOperator && !isAdmin && !isManager) {
    const [checklist, reportingWindowDecision] = await Promise.all([
      getOperatorDailyChecklist(user.id),
      getOperatorReportingWindowDecision(user.roles),
    ])

    return (
      <div className="px-4 py-5 sm:p-6">
        <div className="mx-auto max-w-7xl">
          <OperatorDailyChecklist
            dateLabel={checklist.dateLabel}
            platforms={OPERATOR_CHECKLIST_PLATFORMS}
            rows={checklist.rows}
            reportingWindowClosed={!reportingWindowDecision.allowed}
            reportingWindowMessage={reportingWindowDecision.message}
          />
        </div>
      </div>
    )
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

  const today = getJakartaDateString()
  const defaultFrom = today

  // Default to today's Jakarta date if no date params supplied
  const rawFrom = params.dateFrom ?? defaultFrom
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
    status: (params.status === 'valid' || params.status === 'invalid' ? params.status : undefined) as
      | 'valid'
      | 'invalid'
      | undefined,
  }

  const canSeeRecap = isAdmin || isManager

  const [provinces, stats, provinceData, cityData, reportData, dailyData] = await Promise.all([
    getProvinces(),
    getDashboardStats(filters),
    isAdmin ? getProvinceChartData(filters) : Promise.resolve([]),
    isAdmin ? getTopCitiesByPosts(filters) : Promise.resolve([] as Awaited<ReturnType<typeof getTopCitiesByPosts>>),
    canSeeRecap ? getReportData(filters) : Promise.resolve([]),
    getPostsByDate(filters),
  ])

  return (
    <div className="px-4 py-5 sm:p-6">
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
          </>
        )}

        <DailyPostsChart data={dailyData} />

        {canSeeRecap && <ReportTable data={reportData} />}
      </div>
    </div>
  )
}
