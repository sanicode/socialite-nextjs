'use server'

import { prisma } from '@/app/lib/prisma'

export type DashboardFilters = {
  dateFrom?: string
  dateTo?: string
  provinceId?: string
  cityId?: string
  tenantId?: string
}

export type DashboardStats = {
  userCount: number
  postCount: number
  verifiedCount: number
}

export type ChartItem = {
  name: string
  value: number
}

export type ProvinceChartItem = {
  name: string
  posts: number
  operators: number
}

export type ReportRow = Record<string, unknown>

export async function getProvinces(): Promise<{ id: number; name: string }[]> {
  const provinces = await prisma.reg_provinces.findMany({ orderBy: { name: 'asc' } })
  return provinces.map((p) => ({ id: p.id, name: p.name }))
}

export async function getCities(provinceId?: string): Promise<{ id: string; name: string }[]> {
  const where = provinceId ? { province_id: parseInt(provinceId, 10) } : {}
  const cities = await prisma.reg_cities.findMany({ where, orderBy: { name: 'asc' } })
  return cities.map((c) => ({ id: c.id.toString(), name: c.name }))
}

export async function getDashboardStats(filters: DashboardFilters): Promise<DashboardStats> {
  const { provinceId, cityId, dateFrom, dateTo, tenantId } = filters
  const needsGeoFilter = provinceId || cityId
  const needsTenantJoin = needsGeoFilter || tenantId

  const postConditions: string[] = []
  const params: unknown[] = []
  let idx = 1

  if (dateFrom) {
    postConditions.push(`bp.created_at >= $${idx}::timestamp`)
    params.push(dateFrom)
    idx++
  }
  if (dateTo) {
    postConditions.push(`bp.created_at <= $${idx}::timestamp`)
    params.push(dateTo + 'T23:59:59')
    idx++
  }

  let joinClause = ''
  const geoConditions: string[] = []

  if (needsTenantJoin) {
    joinClause = `INNER JOIN tenant_user tu ON tu.user_id = bp.user_id`
    if (tenantId) {
      geoConditions.push(`tu.tenant_id = $${idx}`)
      params.push(parseInt(tenantId, 10))
      idx++
    }
    if (needsGeoFilter) {
      joinClause += ` INNER JOIN addresses a ON a.tenant_id = tu.tenant_id`
      if (provinceId) {
        geoConditions.push(`a.province_id = $${idx}`)
        params.push(parseInt(provinceId, 10))
        idx++
      }
      if (cityId) {
        geoConditions.push(`a.city_id = $${idx}`)
        params.push(parseInt(cityId, 10))
        idx++
      }
    }
  }

  const allConditions = [...postConditions, ...geoConditions]
  const whereClause = allConditions.length > 0 ? 'WHERE ' + allConditions.join(' AND ') : ''

  const result = await prisma.$queryRawUnsafe<{ user_count: bigint; post_count: bigint; verified_count: bigint }[]>(
    `SELECT
      COUNT(DISTINCT bp.user_id) as user_count,
      COUNT(bp.id) as post_count,
      COUNT(CASE WHEN bp.status = 'valid' THEN 1 END) as verified_count
    FROM blog_posts bp
    ${joinClause}
    ${whereClause}`,
    ...params
  )

  const row = result[0]
  return {
    userCount: Number(row?.user_count ?? 0),
    postCount: Number(row?.post_count ?? 0),
    verifiedCount: Number(row?.verified_count ?? 0),
  }
}

export async function getPostsByProvince(filters: DashboardFilters): Promise<ChartItem[]> {
  const conditions: string[] = []
  const params: unknown[] = []
  let idx = 1

  if (filters.dateFrom) {
    conditions.push(`bp.created_at >= $${idx}::timestamp`)
    params.push(filters.dateFrom)
    idx++
  }
  if (filters.dateTo) {
    conditions.push(`bp.created_at <= $${idx}::timestamp`)
    params.push(filters.dateTo + 'T23:59:59')
    idx++
  }
  if (filters.tenantId) {
    conditions.push(`tu.tenant_id = $${idx}`)
    params.push(parseInt(filters.tenantId, 10))
    idx++
  }
  if (filters.provinceId) {
    conditions.push(`a.province_id = $${idx}`)
    params.push(parseInt(filters.provinceId, 10))
    idx++
  }
  if (filters.cityId) {
    conditions.push(`a.city_id = $${idx}`)
    params.push(parseInt(filters.cityId, 10))
    idx++
  }

  const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : ''

  const result = await prisma.$queryRawUnsafe<{ name: string; value: bigint }[]>(
    `SELECT rp.name, COUNT(bp.id) as value
     FROM blog_posts bp
     INNER JOIN tenant_user tu ON tu.user_id = bp.user_id
     INNER JOIN addresses a ON a.tenant_id = tu.tenant_id
     INNER JOIN reg_provinces rp ON rp.id = a.province_id
     ${whereClause}
     GROUP BY rp.id, rp.name
     ORDER BY value DESC`,
    ...params
  )

  return result.map((r) => ({ name: r.name, value: Number(r.value) }))
}

export async function getProvinceChartData(filters: DashboardFilters): Promise<ProvinceChartItem[]> {
  const postConditions: string[] = []
  const postParams: unknown[] = []
  let idx = 1

  if (filters.dateFrom) {
    postConditions.push(`bp.created_at >= $${idx}::timestamp`)
    postParams.push(filters.dateFrom)
    idx++
  }
  if (filters.dateTo) {
    postConditions.push(`bp.created_at <= $${idx}::timestamp`)
    postParams.push(filters.dateTo + 'T23:59:59')
    idx++
  }
  if (filters.tenantId) {
    postConditions.push(`tu.tenant_id = $${idx}`)
    postParams.push(parseInt(filters.tenantId, 10))
    idx++
  }
  if (filters.provinceId) {
    postConditions.push(`a.province_id = $${idx}`)
    postParams.push(parseInt(filters.provinceId, 10))
    idx++
  }
  if (filters.cityId) {
    postConditions.push(`a.city_id = $${idx}`)
    postParams.push(parseInt(filters.cityId, 10))
    idx++
  }

  const postWhere = postConditions.length > 0 ? 'WHERE ' + postConditions.join(' AND ') : ''

  // Build operator filter (no date filter — operators are people, not time-bound)
  const opConditions: string[] = []
  const opParams: unknown[] = []
  let opIdx = 1

  if (filters.tenantId) {
    opConditions.push(`tu2.tenant_id = $${opIdx}`)
    opParams.push(parseInt(filters.tenantId, 10))
    opIdx++
  }
  if (filters.provinceId) {
    opConditions.push(`a2.province_id = $${opIdx}`)
    opParams.push(parseInt(filters.provinceId, 10))
    opIdx++
  }
  if (filters.cityId) {
    opConditions.push(`a2.city_id = $${opIdx}`)
    opParams.push(parseInt(filters.cityId, 10))
    opIdx++
  }

  const opWhere = opConditions.length > 0 ? 'WHERE ' + opConditions.join(' AND ') : ''

  const [postRows, opRows] = await Promise.all([
    prisma.$queryRawUnsafe<{ name: string; posts: bigint }[]>(
      `SELECT rp.name, COUNT(bp.id) as posts
       FROM blog_posts bp
       INNER JOIN tenant_user tu ON tu.user_id = bp.user_id
       INNER JOIN addresses a ON a.tenant_id = tu.tenant_id
       INNER JOIN reg_provinces rp ON rp.id = a.province_id
       ${postWhere}
       GROUP BY rp.id, rp.name`,
      ...postParams
    ),
    prisma.$queryRawUnsafe<{ name: string; operators: bigint }[]>(
      `SELECT rp2.name, COUNT(DISTINCT tu2.user_id) as operators
       FROM tenant_user tu2
       INNER JOIN addresses a2 ON a2.tenant_id = tu2.tenant_id
       INNER JOIN reg_provinces rp2 ON rp2.id = a2.province_id
       INNER JOIN model_has_roles mhr ON mhr.model_id = tu2.id AND mhr.model_type = 'App\\Models\\TenantUser'
       INNER JOIN roles r ON r.id = mhr.role_id AND r.name = 'operator'
       ${opWhere}
       GROUP BY rp2.id, rp2.name`,
      ...opParams
    ),
  ])

  // Merge by province name
  const opMap = new Map(opRows.map((r) => [r.name, Number(r.operators)]))
  const postMap = new Map(postRows.map((r) => [r.name, Number(r.posts)]))

  const allNames = new Set([...postMap.keys(), ...opMap.keys()])
  const merged: ProvinceChartItem[] = Array.from(allNames).map((name) => ({
    name,
    posts: postMap.get(name) ?? 0,
    operators: opMap.get(name) ?? 0,
  }))

  return merged.sort((a, b) => {
    const ratioB = b.operators > 0 ? b.posts / b.operators : b.posts
    const ratioA = a.operators > 0 ? a.posts / a.operators : a.posts
    return ratioB - ratioA
  })
}

export async function getTopCitiesByPosts(filters: DashboardFilters): Promise<ProvinceChartItem[]> {
  const postConditions: string[] = []
  const postParams: unknown[] = []
  let idx = 1

  if (filters.dateFrom) {
    postConditions.push(`bp.created_at >= $${idx}::timestamp`)
    postParams.push(filters.dateFrom)
    idx++
  }
  if (filters.dateTo) {
    postConditions.push(`bp.created_at <= $${idx}::timestamp`)
    postParams.push(filters.dateTo + 'T23:59:59')
    idx++
  }
  if (filters.tenantId) {
    postConditions.push(`tu.tenant_id = $${idx}`)
    postParams.push(parseInt(filters.tenantId, 10))
    idx++
  }
  if (filters.provinceId) {
    postConditions.push(`a.province_id = $${idx}`)
    postParams.push(parseInt(filters.provinceId, 10))
    idx++
  }
  if (filters.cityId) {
    postConditions.push(`a.city_id = $${idx}`)
    postParams.push(parseInt(filters.cityId, 10))
    idx++
  }

  const postWhere = postConditions.length > 0 ? 'WHERE ' + postConditions.join(' AND ') : ''

  const opConditions: string[] = []
  const opParams: unknown[] = []
  let opIdx = 1

  if (filters.tenantId) {
    opConditions.push(`tu2.tenant_id = $${opIdx}`)
    opParams.push(parseInt(filters.tenantId, 10))
    opIdx++
  }
  if (filters.provinceId) {
    opConditions.push(`a2.province_id = $${opIdx}`)
    opParams.push(parseInt(filters.provinceId, 10))
    opIdx++
  }
  if (filters.cityId) {
    opConditions.push(`a2.city_id = $${opIdx}`)
    opParams.push(parseInt(filters.cityId, 10))
    opIdx++
  }

  const opWhere = opConditions.length > 0 ? 'WHERE ' + opConditions.join(' AND ') : ''

  const [postRows, opRows] = await Promise.all([
    prisma.$queryRawUnsafe<{ name: string; posts: bigint }[]>(
      `SELECT rc.name, COUNT(bp.id) as posts
       FROM blog_posts bp
       INNER JOIN tenant_user tu ON tu.user_id = bp.user_id
       INNER JOIN addresses a ON a.tenant_id = tu.tenant_id
       INNER JOIN reg_cities rc ON rc.id = a.city_id
       ${postWhere}
       GROUP BY rc.id, rc.name`,
      ...postParams
    ),
    prisma.$queryRawUnsafe<{ name: string; operators: bigint }[]>(
      `SELECT rc2.name, COUNT(DISTINCT tu2.user_id) as operators
       FROM tenant_user tu2
       INNER JOIN addresses a2 ON a2.tenant_id = tu2.tenant_id
       INNER JOIN reg_cities rc2 ON rc2.id = a2.city_id
       INNER JOIN model_has_roles mhr ON mhr.model_id = tu2.id AND mhr.model_type = 'App\\Models\\TenantUser'
       INNER JOIN roles r ON r.id = mhr.role_id AND r.name = 'operator'
       ${opWhere}
       GROUP BY rc2.id, rc2.name`,
      ...opParams
    ),
  ])

  const opMap = new Map(opRows.map((r) => [r.name, Number(r.operators)]))
  const postMap = new Map(postRows.map((r) => [r.name, Number(r.posts)]))

  const allNames = new Set([...postMap.keys(), ...opMap.keys()])
  const merged: ProvinceChartItem[] = Array.from(allNames).map((name) => ({
    name,
    posts: postMap.get(name) ?? 0,
    operators: opMap.get(name) ?? 0,
  }))

  merged.sort((a, b) => {
    const ratioB = b.operators > 0 ? b.posts / b.operators : b.posts
    const ratioA = a.operators > 0 ? a.posts / a.operators : a.posts
    return ratioB - ratioA
  })

  return merged.slice(0, 10)
}

export async function getReportData(filters: DashboardFilters): Promise<ReportRow[]> {
  const conditions: string[] = []
  const params: unknown[] = []
  let idx = 1

  if (filters.dateFrom) {
    conditions.push(`tanggal_pelaporan >= $${idx}::date`)
    params.push(filters.dateFrom)
    idx++
  }
  if (filters.dateTo) {
    conditions.push(`tanggal_pelaporan <= $${idx}::date`)
    params.push(filters.dateTo)
    idx++
  }
  if (filters.tenantId) {
    // Scope to users belonging to this tenant
    const tenantUsers = await prisma.tenant_user.findMany({
      where: { tenant_id: BigInt(filters.tenantId) },
      select: { user_id: true },
    })
    const userIds = tenantUsers.map((tu) => tu.user_id)
    if (userIds.length > 0) {
      const emails = await prisma.users.findMany({
        where: { id: { in: userIds } },
        select: { email: true },
      })
      const emailList = emails.map((u) => u.email)
      if (emailList.length > 0) {
        conditions.push(`email = ANY($${idx}::varchar[])`)
        params.push(emailList)
        idx++
      }
    } else {
      // No users in tenant, return empty
      return []
    }
  }
  if (filters.provinceId) {
    const prov = await prisma.reg_provinces.findUnique({ where: { id: parseInt(filters.provinceId, 10) } })
    if (prov) {
      conditions.push(`propinsi = $${idx}`)
      params.push(prov.name)
      idx++
    }
  }
  if (filters.cityId) {
    const city = await prisma.reg_cities.findUnique({ where: { id: BigInt(filters.cityId) } })
    if (city) {
      conditions.push(`kabupaten_kota = $${idx}`)
      params.push(city.name)
      idx++
    }
  }

  const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : ''

  const result = await prisma.$queryRawUnsafe<ReportRow[]>(
    `SELECT * FROM v_rekapitulasi_pelaporan ${whereClause} ORDER BY tanggal_pelaporan DESC`,
    ...params
  )

  // Serialize BigInt values to strings
  return result.map((row) => {
    const serialized: ReportRow = {}
    for (const [key, value] of Object.entries(row)) {
      serialized[key] = typeof value === 'bigint' ? value.toString() : value
    }
    return serialized
  })
}

export async function getPostsByDate(filters: DashboardFilters): Promise<ChartItem[]> {
  const conditions: string[] = []
  const params: unknown[] = []
  let idx = 1

  if (filters.dateFrom) {
    conditions.push(`bp.created_at >= $${idx}::timestamp`)
    params.push(filters.dateFrom)
    idx++
  }
  if (filters.dateTo) {
    conditions.push(`bp.created_at <= $${idx}::timestamp`)
    params.push(filters.dateTo + 'T23:59:59')
    idx++
  }
  if (filters.tenantId) {
    conditions.push(`tu.tenant_id = $${idx}`)
    params.push(parseInt(filters.tenantId, 10))
    idx++
  }
  if (filters.provinceId) {
    conditions.push(`a.province_id = $${idx}`)
    params.push(parseInt(filters.provinceId, 10))
    idx++
  }
  if (filters.cityId) {
    conditions.push(`a.city_id = $${idx}`)
    params.push(parseInt(filters.cityId, 10))
    idx++
  }

  const needsGeoJoin = filters.provinceId || filters.cityId
  const needsTenantJoin = filters.tenantId || needsGeoJoin

  let joinClause = ''
  if (needsTenantJoin) {
    joinClause = 'INNER JOIN tenant_user tu ON tu.user_id = bp.user_id'
    if (needsGeoJoin) {
      joinClause += ' INNER JOIN addresses a ON a.tenant_id = tu.tenant_id'
    }
  }

  const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : ''

  const result = await prisma.$queryRawUnsafe<{ date: Date; value: bigint }[]>(
    `SELECT DATE(bp.created_at) as date, COUNT(bp.id) as value
     FROM blog_posts bp
     ${joinClause}
     ${whereClause}
     GROUP BY DATE(bp.created_at)
     ORDER BY date ASC`,
    ...params
  )

  return result.map((r) => ({
    name: new Date(r.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
    value: Number(r.value),
  }))
}
