'use server'

import { cache } from 'react'
import { prisma } from '@/app/lib/prisma'

export type DashboardFilters = {
  dateFrom?: string
  dateTo?: string
  provinceId?: string
  cityId?: string
  tenantId?: string
  status?: 'valid' | 'invalid'
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

export type CityChartGroup = {
  province: string
  cities: ProvinceChartItem[]
}

export type ReportRow = Record<string, unknown>

const REKAPITULASI_REPORT_COLUMNS = [
  'tanggal_pelaporan',
  'email',
  'nama_operator',
  'no_hp',
  'propinsi',
  'kabupaten_kota',
  'tiktok_link',
  'instagram_link',
  'facebook_link',
  'tiktok_screenshot',
  'instagram_screenshot',
  'facebook_screenshot',
  'amplifikasi_1',
  'amplifikasi_2',
  'amplifikasi_3',
  'amplifikasi_4',
].map((column) => `v.${column}`).join(',\n      ')

const getProvincesCached = cache(async () => {
  return prisma.reg_provinces.findMany({ orderBy: { name: 'asc' } })
})

const getCitiesCached = cache(async (provinceId?: string) => {
  const where = provinceId ? { province_id: parseInt(provinceId, 10) } : {}
  return prisma.reg_cities.findMany({ where, orderBy: { name: 'asc' } })
})

const resolveLocationNames = cache(async (provinceId?: string, cityId?: string) => {
  const [province, city] = await Promise.all([
    provinceId
      ? prisma.reg_provinces.findUnique({ where: { id: parseInt(provinceId, 10) } })
      : Promise.resolve(null),
    cityId
      ? prisma.reg_cities.findUnique({ where: { id: BigInt(cityId) } })
      : Promise.resolve(null),
  ])

  return {
    provinceName: province?.name,
    cityName: city?.name,
  }
})

function buildRekapitulasiReportFilters(filters: DashboardFilters, provinceName?: string, cityName?: string) {
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
    conditions.push(`tenant_id = $${idx}`)
    params.push(parseInt(filters.tenantId, 10))
    idx++
  }
  if (provinceName) {
    conditions.push(`propinsi = $${idx}`)
    params.push(provinceName)
    idx++
  }
  if (cityName) {
    conditions.push(`kabupaten_kota = $${idx}`)
    params.push(cityName)
    idx++
  }

  return {
    whereClause: conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '',
    params,
  }
}

export async function getProvinces(): Promise<{ id: number; name: string }[]> {
  const provinces = await getProvincesCached()
  return provinces.map((p) => ({ id: p.id, name: p.name }))
}

export async function getCities(provinceId?: string): Promise<{ id: string; name: string }[]> {
  const cities = await getCitiesCached(provinceId)
  return cities.map((c) => ({ id: c.id.toString(), name: c.name }))
}

export async function getDashboardStats(filters: DashboardFilters): Promise<DashboardStats> {
  const { tenantId } = filters
  const { provinceName, cityName } = await resolveLocationNames(filters.provinceId, filters.cityId)

  const { whereClause, params } = buildRekapitulasiReportFilters(filters, provinceName, cityName)
  const statusClause = filters.status
    ? `${whereClause ? 'AND' : 'WHERE'} EXISTS (
         SELECT 1
         FROM blog_posts bp
         INNER JOIN users u ON u.id = bp.user_id
         WHERE u.email = v.email
           AND date(bp.created_at) = v.tanggal_pelaporan
           AND bp.status::text = $${params.length + 1}::text
       )`
    : ''
  const postResult = await prisma.$queryRawUnsafe<{ post_count: bigint }[]>(
    `
    SELECT COUNT(*) AS post_count
    FROM v_rekapitulasi_pelaporan v
    ${whereClause}
    ${statusClause}
    `,
    ...params,
    ...(filters.status ? [filters.status] : [])
  )

  const validStatusClause = `${whereClause ? 'AND' : 'WHERE'} EXISTS (
       SELECT 1
       FROM blog_posts bp
       INNER JOIN users u ON u.id = bp.user_id
       WHERE u.email = v.email
         AND date(bp.created_at) = v.tanggal_pelaporan
         AND bp.status::text = $${params.length + 1}::text
     )`
  const verifiedResult = await prisma.$queryRawUnsafe<{ verified_count: bigint }[]>(
    `
    SELECT COUNT(*) AS verified_count
    FROM v_rekapitulasi_pelaporan v
    ${whereClause}
    ${validStatusClause}
    `,
    ...params,
    'valid'
  )

  // User count (kuota) from v_kuota_per_kota — not filtered by date but filtered by current city of manager
  const kuotaConditions: string[] = []
  const kuotaParams: unknown[] = []
  let ki = 1
  if (provinceName) {
    kuotaConditions.push(`propinsi = $${ki}`)
    kuotaParams.push(provinceName)
    ki++
  }
  if (cityName) {
    kuotaConditions.push(`kota = $${ki}`)
    kuotaParams.push(cityName)
    ki++
  }
  // Tenant scoping: if tenantId is provided, we need to filter kuota by tenant's users as well
  if (tenantId) {
    kuotaConditions.push(
      `tenant_id IN (SELECT tenant_id FROM tenant_user WHERE user_id IN (SELECT id FROM users WHERE email IN (SELECT email FROM users u JOIN tenant_user tu ON tu.user_id = u.id WHERE tu.tenant_id = $${ki})))`
    )
    kuotaParams.push(parseInt(tenantId, 10))
    ki++
  }
  
  const kuotaWhere = kuotaConditions.length > 0 ? 'WHERE ' + kuotaConditions.join(' AND ') : ''

  const kuotaResult = await prisma.$queryRawUnsafe<{ user_count: bigint }[]>(
    `SELECT COALESCE(SUM(jumlah), 0) AS user_count FROM v_kuota_per_kota ${kuotaWhere}`,
    ...kuotaParams
  )

  const postRow = postResult[0]
  const verifiedRow = verifiedResult[0]
  const kuotaRow = kuotaResult[0]
  return {
    userCount: Number(kuotaRow?.user_count ?? 0),
    postCount: Number(postRow?.post_count ?? 0),
    verifiedCount: Number(verifiedRow?.verified_count ?? 0),
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
  if (filters.status) {
    conditions.push(`bp.status = $${idx}`)
    params.push(filters.status)
    idx++
  }

  const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : ''

  const result = await prisma.$queryRawUnsafe<{ name: string; value: bigint }[]>(
    `SELECT rp.name, COUNT(bp.id) as value
     FROM v_pelaporan_media_sosial v
     LEFT JOIN blog_posts bp ON bp.slug = v.bukti_upload
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
  const { provinceName, cityName } = await resolveLocationNames(filters.provinceId, filters.cityId)

  const postConditions: string[] = []
  const postParams: unknown[] = []
  let idx = 1

  if (filters.dateFrom) {
    postConditions.push(`tanggal_pelaporan >= $${idx}::date`)
    postParams.push(filters.dateFrom)
    idx++
  }
  if (filters.dateTo) {
    postConditions.push(`tanggal_pelaporan <= $${idx}::date`)
    postParams.push(filters.dateTo)
    idx++
  }
  if (filters.tenantId) {
    postConditions.push(`tenant_id = $${idx}`)
    postParams.push(parseInt(filters.tenantId, 10))
    idx++
  }
  if (provinceName) {
    postConditions.push(`propinsi = $${idx}`)
    postParams.push(provinceName)
    idx++
  }
  if (cityName) {
    postConditions.push(`kabupaten_kota = $${idx}`)
    postParams.push(cityName)
    idx++
  }
  const postWhere = postConditions.length > 0 ? 'WHERE ' + postConditions.join(' AND ') : ''
  const statusClause = filters.status
    ? `${postWhere ? 'AND' : 'WHERE'} EXISTS (
         SELECT 1
         FROM blog_posts bp
         INNER JOIN users u ON u.id = bp.user_id
         WHERE u.email = v.email
           AND date(bp.created_at) = v.tanggal_pelaporan
           AND bp.status::text = $${postParams.length + 1}::text
       )`
    : ''

  // Operators: no date filter — kuota is total distinct operators per province
  const opConditions: string[] = []
  const opParams: unknown[] = []
  let opIdx = 1

  if (provinceName) {
    opConditions.push(`propinsi = $${opIdx}`)
    opParams.push(provinceName)
    opIdx++
  }
  if (cityName) {
    opConditions.push(`kabupaten_kota = $${opIdx}`)
    opParams.push(cityName)
    opIdx++
  }

  const opWhere = opConditions.length > 0 ? 'WHERE ' + opConditions.join(' AND ') : ''

  const [postRows, opRows] = await Promise.all([
    prisma.$queryRawUnsafe<{ name: string; posts: bigint }[]>(
      `SELECT propinsi AS name, COUNT(*) AS posts
       FROM v_rekapitulasi_pelaporan v
       ${postWhere}
       ${statusClause}
       GROUP BY propinsi`,
      ...postParams,
      ...(filters.status ? [filters.status] : [])
    ),
    prisma.$queryRawUnsafe<{ name: string; operators: bigint }[]>(
      `SELECT propinsi AS name, SUM(jumlah) AS operators
       FROM v_kuota_per_kota
       ${opWhere}
       GROUP BY propinsi`,
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

  return merged.sort((a, b) => {
    const ratioB = b.operators > 0 ? b.posts / b.operators : b.posts
    const ratioA = a.operators > 0 ? a.posts / a.operators : a.posts
    return ratioB - ratioA
  })
}

export async function getTopCitiesByPosts(filters: DashboardFilters): Promise<CityChartGroup[]> {
  const { provinceName, cityName } = await resolveLocationNames(filters.provinceId, filters.cityId)

  const postConditions: string[] = []
  const postParams: unknown[] = []
  let idx = 1

  if (filters.dateFrom) {
    postConditions.push(`tanggal_pelaporan >= $${idx}::date`)
    postParams.push(filters.dateFrom)
    idx++
  }
  if (filters.dateTo) {
    postConditions.push(`tanggal_pelaporan <= $${idx}::date`)
    postParams.push(filters.dateTo)
    idx++
  }
  if (filters.tenantId) {
    postConditions.push(`tenant_id = $${idx}`)
    postParams.push(parseInt(filters.tenantId, 10))
    idx++
  }
  if (provinceName) {
    postConditions.push(`propinsi = $${idx}`)
    postParams.push(provinceName)
    idx++
  }
  if (cityName) {
    postConditions.push(`kabupaten_kota = $${idx}`)
    postParams.push(cityName)
    idx++
  }
  const postWhere = postConditions.length > 0 ? 'WHERE ' + postConditions.join(' AND ') : ''
  const statusClause = filters.status
    ? `${postWhere ? 'AND' : 'WHERE'} EXISTS (
         SELECT 1
         FROM blog_posts bp
         INNER JOIN users u ON u.id = bp.user_id
         WHERE u.email = v.email
           AND date(bp.created_at) = v.tanggal_pelaporan
           AND bp.status::text = $${postParams.length + 1}::text
       )`
    : ''

  // Operators: from v_kuota_per_kota — no date filter, kuota is capacity not activity
  const opConditions: string[] = []
  const opParams: unknown[] = []
  let opIdx = 1

  if (provinceName) {
    opConditions.push(`propinsi = $${opIdx}`)
    opParams.push(provinceName)
    opIdx++
  }
  if (cityName) {
    opConditions.push(`kota = $${opIdx}`)
    opParams.push(cityName)
    opIdx++
  }

  const opWhere = opConditions.length > 0 ? 'WHERE ' + opConditions.join(' AND ') : ''

  const [postRows, opRows] = await Promise.all([
    prisma.$queryRawUnsafe<{ province: string; name: string; posts: bigint }[]>(
      `SELECT propinsi AS province, kabupaten_kota AS name, COUNT(*) AS posts
       FROM v_rekapitulasi_pelaporan v
       ${postWhere}
       ${statusClause}
       GROUP BY propinsi, kabupaten_kota`,
      ...postParams,
      ...(filters.status ? [filters.status] : [])
    ),
    prisma.$queryRawUnsafe<{ province: string; name: string; operators: bigint }[]>(
      `SELECT propinsi AS province, kota AS name, jumlah AS operators
       FROM v_kuota_per_kota
       ${opWhere}`,
      ...opParams
    ),
  ])

  // Build nested map: province -> city -> {posts, operators}
  const map = new Map<string, Map<string, { posts: number; operators: number }>>()

  for (const r of postRows) {
    if (!map.has(r.province)) map.set(r.province, new Map())
    const cities = map.get(r.province)!
    const cur = cities.get(r.name) ?? { posts: 0, operators: 0 }
    cities.set(r.name, { ...cur, posts: Number(r.posts) })
  }
  for (const r of opRows) {
    if (!map.has(r.province)) map.set(r.province, new Map())
    const cities = map.get(r.province)!
    const cur = cities.get(r.name) ?? { posts: 0, operators: 0 }
    cities.set(r.name, { ...cur, operators: Number(r.operators) })
  }

  const groups: CityChartGroup[] = Array.from(map.entries()).map(([province, cities]) => {
    const items: ProvinceChartItem[] = Array.from(cities.entries()).map(([name, d]) => ({
      name,
      posts: d.posts,
      operators: d.operators,
    }))
    items.sort((a, b) => {
      const rb = b.operators > 0 ? b.posts / b.operators : b.posts
      const ra = a.operators > 0 ? a.posts / a.operators : a.posts
      return rb - ra
    })
    return { province, cities: items }
  })

  return groups
    .filter((g) => g.province != null)
    .sort((a, b) => a.province.localeCompare(b.province))
}

export async function getReportData(filters: DashboardFilters): Promise<ReportRow[]> {
  const { provinceName, cityName } = await resolveLocationNames(filters.provinceId, filters.cityId)
  const { whereClause, params } = buildRekapitulasiReportFilters(filters, provinceName, cityName)
  const statusClause = filters.status
    ? `${whereClause ? 'AND' : 'WHERE'} EXISTS (
         SELECT 1
         FROM blog_posts bp
         INNER JOIN users u ON u.id = bp.user_id
         WHERE u.email = v.email
           AND date(bp.created_at) = v.tanggal_pelaporan
           AND bp.status::text = $${params.length + 1}::text
       )`
    : ''

  const result = await prisma.$queryRawUnsafe<ReportRow[]>(
    `SELECT
      ${REKAPITULASI_REPORT_COLUMNS}
     FROM v_rekapitulasi_pelaporan v
     ${whereClause}
     ${statusClause}
     ORDER BY tanggal_pelaporan DESC, nama_operator`,
    ...params,
    ...(filters.status ? [filters.status] : [])
  )

  // Serialize BigInt values to strings
  return result.map((row) => {
    const serialized: ReportRow = {}
    for (const [key, value] of Object.entries(row)) {
      if (key === 'tenant_id') continue
      serialized[key] = typeof value === 'bigint' ? value.toString() : value
    }
    return serialized
  })
}

export async function getPostsByDate(filters: DashboardFilters): Promise<ChartItem[]> {
  const { provinceName, cityName } = await resolveLocationNames(filters.provinceId, filters.cityId)
  const { whereClause, params } = buildRekapitulasiReportFilters(filters, provinceName, cityName)

  const statusClause = filters.status
    ? `${whereClause ? 'AND' : 'WHERE'} EXISTS (
         SELECT 1
         FROM blog_posts bp
         INNER JOIN users u ON u.id = bp.user_id
         WHERE u.email = v.email
           AND date(bp.created_at) = v.tanggal_pelaporan
           AND bp.status::text = $${params.length + 1}::text
       )`
    : ''
  const result = await prisma.$queryRawUnsafe<{ date: string; value: bigint }[]>(
    `
    SELECT
      to_char(tanggal_pelaporan, 'YYYY-MM-DD') AS date,
      COUNT(*) AS value
    FROM v_rekapitulasi_pelaporan v
    ${whereClause}
    ${statusClause}
    GROUP BY tanggal_pelaporan
    ORDER BY date ASC
    `,
    ...params,
    ...(filters.status ? [filters.status] : [])
  )

  return result.map((r) => ({
    name: new Date(`${r.date}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
    value: Number(r.value),
  }))
}
