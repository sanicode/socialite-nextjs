import { requireJwtRole, apiError, ApiError, requireApiEnabled } from '@/app/lib/api-auth'
import { prisma } from '@/app/lib/prisma'
import { logEvent } from '@/app/lib/logger'

type Ctx = { params: Promise<{ id: string }> }

// ── GET /api/mobile/tenants/[id] ──────────────────────────────────────────────

export async function GET(request: Request, { params }: Ctx) {
  try {
    await requireApiEnabled()
    requireJwtRole(request, 'admin')
    const { id } = await params

    const tenant = await prisma.tenants.findUnique({ where: { id: BigInt(id) } })
    if (!tenant) return Response.json({ error: 'Tenant tidak ditemukan' }, { status: 404 })

    const address = await prisma.addresses.findFirst({
      where: { tenant_id: BigInt(id) },
      orderBy: { id: 'asc' },
    })
    const city = address?.city_id
      ? await prisma.reg_cities.findUnique({
          where: { id: BigInt(address.city_id) },
          select: { province_id: true },
        })
      : null

    return Response.json({
      id: tenant.id.toString(),
      name: tenant.name,
      domain: tenant.domain,
      address: {
        id: address?.id.toString() ?? null,
        address_line_1: address?.address_line_1 ?? null,
        city: address?.city ?? null,
        state: address?.state ?? null,
        zip: address?.zip ?? null,
        province_id: city?.province_id ?? null,
        city_id: address?.city_id ?? null,
      },
    })
  } catch (error) {
    return apiError(error)
  }
}

// ── PUT /api/mobile/tenants/[id] ──────────────────────────────────────────────

export async function PUT(request: Request, { params }: Ctx) {
  try {
    await requireApiEnabled()
    const admin = requireJwtRole(request, 'admin')
    const { id } = await params
    const body = await request.json()

    const name = (body.name ?? '').trim()
    if (!name) throw new ApiError(422, 'Nama tenant tidak boleh kosong.')

    const domain = (body.domain ?? '').trim() || null

    await prisma.tenants.update({
      where: { id: BigInt(id) },
      data: { name, domain, updated_at: new Date() },
    })

    const cityId = body.address?.city_id ?? null
    const city = cityId
      ? await prisma.reg_cities.findUnique({
          where: { id: BigInt(cityId) },
          select: { province_id: true },
        })
      : null

    const address = {
      address_line_1: (body.address?.address_line_1 ?? '').trim() || null,
      city: (body.address?.city ?? '').trim() || null,
      state: (body.address?.state ?? '').trim() || null,
      zip: (body.address?.zip ?? '').trim() || null,
      province_id: city?.province_id ?? null,
      city_id: cityId,
    }

    const addressId = body.address?.id
    if (addressId) {
      await prisma.addresses.update({
        where: { id: BigInt(addressId) },
        data: { ...address, updated_at: new Date() },
      })
    } else {
      await prisma.addresses.create({
        data: { ...address, tenant_id: BigInt(id), created_at: new Date(), updated_at: new Date() },
      })
    }

    logEvent('info', 'tenant.updated', { adminId: admin.sub, tenantId: id })
    return Response.json({ success: true })
  } catch (error) {
    return apiError(error)
  }
}

// ── DELETE /api/mobile/tenants/[id] ──────────────────────────────────────────

export async function DELETE(request: Request, { params }: Ctx) {
  try {
    await requireApiEnabled()
    const admin = requireJwtRole(request, 'admin')
    const { id } = await params

    const result = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
      `SELECT COUNT(DISTINCT tu.id) AS count
       FROM tenant_user tu
       INNER JOIN model_has_roles mhr
         ON mhr.model_type = 'App\\Models\\TenantUser' AND mhr.model_id = tu.id
       INNER JOIN roles r ON r.id = mhr.role_id AND r.name IN ('manager', 'operator')
       WHERE tu.tenant_id = $1`,
      BigInt(id)
    )

    if (Number(result[0]?.count ?? 0) > 0) {
      throw new ApiError(409, 'Tenant masih memiliki user (manager/operator). Hapus user terlebih dahulu.')
    }

    await prisma.tenants.delete({ where: { id: BigInt(id) } })
    logEvent('warn', 'tenant.deleted', { adminId: admin.sub, tenantId: id })
    return Response.json({ success: true })
  } catch (error) {
    return apiError(error)
  }
}
