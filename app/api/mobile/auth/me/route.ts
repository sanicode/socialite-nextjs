import { prisma } from '@/app/lib/prisma'
import { requireJwt, apiError, requireApiEnabled } from '@/app/lib/api-auth'
import { getUserRoles } from '@/app/lib/permissions'

const MODEL_TYPE_TENANT_USER = 'App\\Models\\TenantUser'

export async function GET(request: Request) {
  try {
    await requireApiEnabled()
    const payload = requireJwt(request)

    const user = await prisma.users.findUnique({
      where: { id: BigInt(payload.sub) },
      select: { id: true, name: true, email: true, phone_number: true, is_admin: true, is_blocked: true },
    })

    if (!user || user.is_blocked) {
      return Response.json({ error: 'Akun tidak ditemukan atau diblokir' }, { status: 401 })
    }

    const roles = await getUserRoles(user.id.toString())
    const tenantUser = await prisma.tenant_user.findFirst({
      where: { user_id: user.id },
      orderBy: [{ is_default: 'desc' }, { id: 'asc' }],
      select: {
        id: true,
        tenants: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    const [tenantAddress, tenantRole] = tenantUser
      ? await Promise.all([
          prisma.addresses.findFirst({
            where: { tenant_id: tenantUser.tenants.id },
            orderBy: { id: 'asc' },
            select: { city_id: true, city: true, state: true },
          }),
          prisma.model_has_roles.findFirst({
            where: {
              model_type: MODEL_TYPE_TENANT_USER,
              model_id: tenantUser.id,
            },
            include: { roles: true },
            orderBy: { role_id: 'asc' },
          }),
        ])
      : [null, null]

    let city: { name: string; province_id: number | null } | null = null
    let province: { name: string } | null = null

    if (tenantAddress?.city_id) {
      city = await prisma.reg_cities.findUnique({
        where: { id: BigInt(tenantAddress.city_id) },
        select: { name: true, province_id: true },
      })
      if (city?.province_id != null) {
        province = await prisma.reg_provinces.findUnique({
          where: { id: city.province_id },
          select: { name: true },
        })
      }
    }

    return Response.json({
      id: user.id.toString(),
      name: user.name,
      email: user.email,
      phone_number: user.phone_number,
      is_admin: user.is_admin,
      roles,
      tenant: tenantUser
        ? {
            id: tenantUser.tenants.id.toString(),
            name: tenantUser.tenants.name,
            city: city?.name ?? tenantAddress?.city ?? null,
            province: province?.name ?? null,
            role: tenantRole?.roles.name ?? null,
          }
        : null,
    })
  } catch (error) {
    return apiError(error)
  }
}
