import { requireJwt, apiError, ApiError, requireApiEnabled } from '@/app/lib/api-auth'
import {
  getDashboardStats,
  getPostsByProvince,
  getProvinceChartData,
  getTopCitiesByPosts,
  getPostsByDate,
  type DashboardFilters,
} from '@/app/actions/dashboard'
import { getUserTenantIds } from '@/app/lib/tenant-access'

export async function GET(request: Request) {
  try {
    await requireApiEnabled()
    const payload = await requireJwt(request)

    if (!payload.roles.includes('admin') && !payload.roles.includes('manager')) {
      throw new ApiError(403, 'Hanya admin atau manager yang dapat mengakses dashboard')
    }

    const { searchParams } = new URL(request.url)
    const statusParam = searchParams.get('status')

    const filters: DashboardFilters = {
      dateFrom:   searchParams.get('dateFrom')   ?? undefined,
      dateTo:     searchParams.get('dateTo')     ?? undefined,
      provinceId: searchParams.get('provinceId') ?? undefined,
      cityId:     searchParams.get('cityId')     ?? undefined,
      tenantId:   searchParams.get('tenantId')   ?? undefined,
      status:     statusParam === 'valid' || statusParam === 'invalid' ? statusParam : undefined,
    }

    // Manager hanya bisa melihat tenant miliknya
    if (payload.roles.includes('manager') && !payload.roles.includes('admin')) {
      const tenantIds = await getUserTenantIds(payload.sub)
      if (tenantIds.length === 0) throw new ApiError(403, 'Akses tenant tidak ditemukan')
      if (filters.tenantId && !tenantIds.includes(filters.tenantId)) {
        throw new ApiError(403, 'Akses tenant ditolak')
      }
      filters.tenantId = filters.tenantId ?? tenantIds[0]
    }

    const [stats, byProvince, provinceChart, topCities, postsByDate] = await Promise.all([
      getDashboardStats(filters),
      getPostsByProvince(filters),
      getProvinceChartData(filters),
      getTopCitiesByPosts(filters),
      getPostsByDate(filters),
    ])

    return Response.json({ stats, byProvince, provinceChart, topCities, postsByDate })
  } catch (error) {
    return apiError(error)
  }
}
