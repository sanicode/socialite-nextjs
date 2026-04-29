import { randomUUID } from 'crypto'
import { requireJwtRole, apiError, ApiError, requireApiEnabled } from '@/app/lib/api-auth'
import { prisma } from '@/app/lib/prisma'
import { logEvent } from '@/app/lib/logger'

// ── GET /api/mobile/tenants ───────────────────────────────────────────────────

export async function GET(request: Request) {
  try {
    await requireApiEnabled()
    requireJwtRole(request, 'admin')
    const { searchParams } = new URL(request.url)

    const page     = Math.max(1, Number(searchParams.get('page') ?? '1') || 1)
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize') ?? '20') || 20))
    const offset   = (page - 1) * pageSize
    const search   = searchParams.get('search') ?? undefined
    const cityId   = searchParams.get('cityId') ?? undefined
    const sortBy   = searchParams.get('sortBy') ?? undefined
    const sortDir  = searchParams.get('sortDir') ?? undefined

    const conditions: string[] = []
    const qParams: unknown[]   = []
    let idx = 1

    if (search) {
      conditions.push(`(t.name ILIKE $${idx} OR t.domain ILIKE $${idx})`)
      qParams.push(`%${search}%`)
      idx++
    }
    if (cityId) {
      conditions.push(
        `EXISTS (SELECT 1 FROM addresses WHERE tenant_id = t.id AND city_id = $${idx} LIMIT 1)`
      )
      qParams.push(parseInt(cityId, 10))
      idx++
    }

    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : ''
    const dir = sortDir === 'desc' ? 'DESC' : 'ASC'
    const orderBy = (() => {
      switch (sortBy) {
        case 'city':           return `city ${dir} NULLS LAST`
        case 'manager_count':  return `manager_count ${dir}`
        case 'operator_count': return `operator_count ${dir}`
        default:               return `t.name ${dir}`
      }
    })()

    const roleCountSql = (roleName: string) => `
      (SELECT COUNT(DISTINCT tu.id)
       FROM tenant_user tu
       WHERE tu.tenant_id = t.id
         AND EXISTS (
           SELECT 1 FROM model_has_roles mhr
           JOIN roles r ON r.id = mhr.role_id
           WHERE r.name = '${roleName}'
             AND mhr.model_type = 'App\\\\Models\\\\TenantUser'
             AND mhr.model_id = tu.id
         )
      )`

    const [rows, countResult] = await Promise.all([
      prisma.$queryRawUnsafe<{
        id: bigint; name: string; domain: string | null; city: string | null
        manager_count: bigint; operator_count: bigint
      }[]>(
        `SELECT
           t.id, t.name, t.domain,
           (SELECT rc.name FROM addresses a2 JOIN reg_cities rc ON rc.id = a2.city_id WHERE a2.tenant_id = t.id ORDER BY a2.id LIMIT 1) AS city,
           ${roleCountSql('manager')}  AS manager_count,
           ${roleCountSql('operator')} AS operator_count
         FROM tenants t
         ${where}
         ORDER BY ${orderBy}
         LIMIT $${idx} OFFSET $${idx + 1}`,
        ...qParams, pageSize, offset
      ),
      prisma.$queryRawUnsafe<{ count: bigint }[]>(
        `SELECT COUNT(*) AS count FROM tenants t ${where}`,
        ...qParams
      ),
    ])

    return Response.json({
      tenants: rows.map((r) => ({
        id: r.id.toString(),
        name: r.name,
        domain: r.domain,
        city: r.city,
        manager_count: Number(r.manager_count),
        operator_count: Number(r.operator_count),
      })),
      total: Number(countResult[0]?.count ?? 0),
    })
  } catch (error) {
    return apiError(error)
  }
}

// ── POST /api/mobile/tenants ──────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    await requireApiEnabled()
    const admin = requireJwtRole(request, 'admin')
    const body = await request.json()

    const name = (body.name ?? '').trim()
    if (!name) throw new ApiError(422, 'Nama tenant tidak boleh kosong.')

    const domain = (body.domain ?? '').trim() || null
    if (domain) {
      const existing = await prisma.tenants.findUnique({ where: { domain } })
      if (existing) throw new ApiError(409, 'Domain sudah digunakan tenant lain.')
    }

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

    const tenant = await prisma.$transaction(async (tx) => {
      const created = await tx.tenants.create({
        data: {
          uuid: randomUUID(),
          name,
          domain,
          created_by: BigInt(admin.sub),
          created_at: new Date(),
          updated_at: new Date(),
        },
      })
      await tx.addresses.create({
        data: { ...address, tenant_id: created.id, created_at: new Date(), updated_at: new Date() },
      })
      return created
    })

    logEvent('info', 'tenant.created', { adminId: admin.sub, tenantId: tenant.id.toString() })
    return Response.json({ id: tenant.id.toString() }, { status: 201 })
  } catch (error) {
    return apiError(error)
  }
}
