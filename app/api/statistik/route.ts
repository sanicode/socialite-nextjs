import { NextResponse } from 'next/server'
import {
  getStatistikCities,
  getStatistikDashboardData,
  normalizeStatistikFilters,
  stripDashboardPii,
  type StatistikFilters,
} from '@/app/lib/statistik-data'
import { getBearerToken } from '@/app/lib/api-auth'
import { getStatistikRequestFingerprint, verifyStatistikToken } from '@/app/lib/statistik-token'

export const dynamic = 'force-dynamic'

function parseFilters(searchParams: URLSearchParams): StatistikFilters {
  const status = searchParams.get('status')
  return normalizeStatistikFilters({
    dateFrom: searchParams.get('dateFrom') ?? undefined,
    dateTo: searchParams.get('dateTo') ?? undefined,
    provinceId: searchParams.get('provinceId') ?? undefined,
    cityId: searchParams.get('cityId') ?? undefined,
    status: status === 'pending' || status === 'valid' || status === 'invalid' ? status : undefined,
  })
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const accessId = url.searchParams.get('id')
  if (accessId !== 'bmi') {
    return NextResponse.json({ message: 'Not found' }, { status: 404 })
  }

  const token = getBearerToken(request)
  const fingerprint = getStatistikRequestFingerprint(request.headers)
  if (!token || !verifyStatistikToken(token, accessId, fingerprint)) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }

  const provinceId = url.searchParams.get('provinceId') ?? undefined
  const [payload, cities] = await Promise.all([
    getStatistikDashboardData(parseFilters(url.searchParams)),
    provinceId ? getStatistikCities(provinceId) : Promise.resolve([]),
  ])

  return NextResponse.json({
    ...stripDashboardPii(payload),
    cities,
  })
}
