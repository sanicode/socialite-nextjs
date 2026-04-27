import { requireJwt, apiError, ApiError, requireApiEnabled } from '@/app/lib/api-auth'
import { getReportData, type DashboardFilters } from '@/app/actions/dashboard'

export async function GET(request: Request) {
  try {
    await requireApiEnabled()
    const payload = requireJwt(request)

    if (!payload.roles.includes('admin') && !payload.roles.includes('manager')) {
      throw new ApiError(403, 'Hanya admin atau manager yang dapat mengakses rekapitulasi')
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
      const { prisma } = await import('@/app/lib/prisma')
      const tu = await prisma.tenant_user.findFirst({
        where: { user_id: BigInt(payload.sub) },
        select: { tenant_id: true },
      })
      if (tu) filters.tenantId = tu.tenant_id.toString()
    }

    const rows = await getReportData(filters)
    return Response.json(rows)
  } catch (error) {
    return apiError(error)
  }
}
