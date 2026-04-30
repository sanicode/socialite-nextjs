import { prisma } from '@/app/lib/prisma'

export type ReportObjectLocation = {
  province: string | null
  city: string | null
}

export async function getReportLocationByTenantId(tenantId: string | bigint | null | undefined): Promise<ReportObjectLocation> {
  if (!tenantId) return { province: null, city: null }

  const address = await prisma.addresses.findFirst({
    where: { tenant_id: typeof tenantId === 'bigint' ? tenantId : BigInt(tenantId) },
    select: { city_id: true },
    orderBy: { id: 'asc' },
  })
  if (!address?.city_id) return { province: null, city: null }

  const city = await prisma.reg_cities.findUnique({
    where: { id: BigInt(address.city_id) },
    select: { name: true, province_id: true },
  })
  if (!city) return { province: null, city: null }

  const province = await prisma.reg_provinces.findUnique({
    where: { id: city.province_id },
    select: { name: true },
  })

  return {
    province: province?.name ?? null,
    city: city.name,
  }
}

export async function getReportLocationByUserId(userId: string): Promise<ReportObjectLocation> {
  const tenantUser = await prisma.tenant_user.findFirst({
    where: { user_id: BigInt(userId) },
    select: { tenant_id: true },
    orderBy: [{ is_default: 'desc' }, { id: 'asc' }],
  })

  return getReportLocationByTenantId(tenantUser?.tenant_id)
}
