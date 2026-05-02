import { notFound } from 'next/navigation'
import {
  getStatistikCities,
  getStatistikDashboardData,
  getStatistikProvinces,
  normalizeStatistikFilters,
  type StatistikFilters,
} from '@/app/lib/statistik-data'
import StatistikDashboardClient from './StatistikDashboardClient'

export const dynamic = 'force-dynamic'

type Props = {
  searchParams: Promise<{
    id?: string
    dateFrom?: string
    dateTo?: string
    provinceId?: string
    cityId?: string
    status?: string
  }>
}

export default async function StatistikPage({ searchParams }: Props) {
  const params = await searchParams
  if (params.id !== 'bmi') notFound()

  const filters: StatistikFilters = normalizeStatistikFilters({
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
    provinceId: params.provinceId,
    cityId: params.cityId,
    status: params.status === 'pending' || params.status === 'valid' || params.status === 'invalid' ? params.status : undefined,
  })

  const [provinces, cities, initialData] = await Promise.all([
    getStatistikProvinces(),
    filters.provinceId ? getStatistikCities(filters.provinceId) : Promise.resolve([]),
    getStatistikDashboardData(filters),
  ])

  return (
    <StatistikDashboardClient
      initialData={initialData}
      initialCities={cities}
      initialFilters={filters}
      provinces={provinces}
      accessId={params.id}
    />
  )
}
