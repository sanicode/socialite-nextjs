'use server'

import { cache } from 'react'
import { prisma } from '@/app/lib/prisma'
import { requireManagerOrAdmin, requireUser } from '@/app/lib/authorization'
import type { SessionUser } from '@/app/lib/session'
import { getUserTenantIds } from '@/app/lib/tenant-access'

export type DashboardFilters = {
  dateFrom?: string
  dateTo?: string
  provinceId?: string
  cityId?: string
  tenantId?: string
  status?: 'pending' | 'valid' | 'invalid'
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

export type OperatorReportRow = {
  tenantUserId: string
  userId: string
  name: string
  email: string
  phoneNumber: string | null
  province: string | null
  city: string | null
  uploadCount: number
  amplifikasiCount: number
  missingUpload: boolean
  missingAmplifikasi: boolean
  hasReported: boolean
}

export type OperatorReportSummary = {
  totalOperators: number
  reportedOperators: number
  missingOperators: number
  reportedRows: OperatorReportRow[]
  missingRows: OperatorReportRow[]
}

export type ReportRow = Record<string, unknown>

const BLOG_POST_JAKARTA_DATE_SQL = `date((bp.created_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Jakarta')`

function buildBlogPostReportFilters(filters: DashboardFilters) {
  const conditions: string[] = [
    `bp.source_url IN ('upload', 'amplifikasi')`,
  ]
  const params: unknown[] = []
  let idx = 1

  if (filters.dateFrom) {
    conditions.push(`${BLOG_POST_JAKARTA_DATE_SQL} >= $${idx}::date`)
    params.push(filters.dateFrom)
    idx++
  }
  if (filters.dateTo) {
    conditions.push(`${BLOG_POST_JAKARTA_DATE_SQL} <= $${idx}::date`)
    params.push(filters.dateTo)
    idx++
  }
  if (filters.tenantId) {
    conditions.push(`bp.tenant_id = $${idx}::bigint`)
    params.push(filters.tenantId)
    idx++
  }
  if (filters.provinceId) {
    conditions.push(`rc.province_id = $${idx}::int`)
    params.push(filters.provinceId)
    idx++
  }
  if (filters.cityId) {
    conditions.push(`addr.city_id = $${idx}::int`)
    params.push(filters.cityId)
    idx++
  }
  if (filters.status) {
    conditions.push(`bp.status::text = $${idx}::text`)
    params.push(filters.status)
    idx++
  }

  return {
    whereClause: `WHERE ${conditions.join(' AND ')}`,
    params,
  }
}

function buildDailyReportedOperatorsCte(whereClause: string) {
  return `
    WITH daily_reported_operators AS (
      SELECT
        ${BLOG_POST_JAKARTA_DATE_SQL} AS tanggal_pelaporan,
        bp.user_id,
        bp.tenant_id,
        rp.name AS province,
        rc.name AS city
      FROM blog_posts bp
      INNER JOIN users u ON u.id = bp.user_id
      INNER JOIN tenant_user tu
        ON tu.user_id = bp.user_id
       AND tu.tenant_id = bp.tenant_id
      INNER JOIN model_has_roles mhr
        ON mhr.model_id = tu.id
       AND mhr.model_type = 'App\\Models\\TenantUser'
      INNER JOIN roles r
        ON r.id = mhr.role_id
       AND r.name = 'operator'
      LEFT JOIN LATERAL (
        SELECT a.city_id
        FROM addresses a
        WHERE a.tenant_id = tu.tenant_id
        ORDER BY a.id ASC
        LIMIT 1
      ) addr ON true
      LEFT JOIN reg_cities rc ON rc.id = addr.city_id
      LEFT JOIN reg_provinces rp ON rp.id = rc.province_id
      ${whereClause}
        AND COALESCE(u.is_blocked, false) = false
      GROUP BY ${BLOG_POST_JAKARTA_DATE_SQL}, bp.user_id, bp.tenant_id, rp.name, rc.name
      HAVING COUNT(*) FILTER (WHERE bp.source_url = 'upload') > 0
         AND COUNT(*) FILTER (WHERE bp.source_url = 'amplifikasi') > 0
    )
  `
}

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

async function scopeDashboardFilters(user: SessionUser, filters: DashboardFilters): Promise<DashboardFilters> {
  if (user.roles.includes('admin')) return filters

  const tenantIds = await getUserTenantIds(user.id)
  if (tenantIds.length === 0) throw new Error('Akses tenant tidak ditemukan')
  if (filters.tenantId && !tenantIds.includes(filters.tenantId)) {
    throw new Error('Akses tenant ditolak')
  }
  return { ...filters, tenantId: filters.tenantId ?? tenantIds[0] }
}

export async function getProvinces(): Promise<{ id: number; name: string }[]> {
  await requireUser()
  const provinces = await getProvincesCached()
  return provinces.map((p) => ({ id: p.id, name: p.name }))
}

export async function getCities(provinceId?: string): Promise<{ id: string; name: string }[]> {
  await requireUser()
  const cities = await getCitiesCached(provinceId)
  return cities.map((c) => ({ id: c.id.toString(), name: c.name }))
}

export async function getDashboardStats(filters: DashboardFilters): Promise<DashboardStats> {
  const user = await requireManagerOrAdmin()
  filters = await scopeDashboardFilters(user, filters)
  const { tenantId } = filters
  const { provinceName, cityName } = await resolveLocationNames(filters.provinceId, filters.cityId)

  const { whereClause, params } = buildRekapitulasiReportFilters(filters, provinceName, cityName)
  const statusClause = filters.status
    ? `${whereClause ? 'AND' : 'WHERE'} EXISTS (
         SELECT 1
         FROM blog_posts bp
         INNER JOIN users u ON u.id = bp.user_id
         WHERE u.email = v.email
           AND ${BLOG_POST_JAKARTA_DATE_SQL} = v.tanggal_pelaporan
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
         AND ${BLOG_POST_JAKARTA_DATE_SQL} = v.tanggal_pelaporan
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
  const user = await requireManagerOrAdmin()
  filters = await scopeDashboardFilters(user, filters)
  const { whereClause, params } = buildBlogPostReportFilters(filters)

  const result = await prisma.$queryRawUnsafe<{ name: string; value: bigint }[]>(
    `${buildDailyReportedOperatorsCte(whereClause)}
     SELECT
       province AS name,
       COUNT(*) AS value
     FROM daily_reported_operators
     WHERE province IS NOT NULL
     GROUP BY province
     ORDER BY value DESC`,
    ...params
  )

  return result.map((r) => ({ name: r.name, value: Number(r.value) }))
}

export async function getProvinceChartData(filters: DashboardFilters): Promise<ProvinceChartItem[]> {
  const user = await requireManagerOrAdmin()
  filters = await scopeDashboardFilters(user, filters)
  const { whereClause, params } = buildBlogPostReportFilters(filters)

  const operatorConditions: string[] = [
    `mhr.model_type = 'App\\Models\\TenantUser'`,
    `mhr.model_id = tu.id`,
    `r.name = 'operator'`,
    `COALESCE(u.is_blocked, false) = false`,
    `rp.name IS NOT NULL`,
  ]
  const operatorParams: unknown[] = []
  let opIdx = 1

  if (filters.tenantId) {
    operatorConditions.push(`tu.tenant_id = $${opIdx}::bigint`)
    operatorParams.push(filters.tenantId)
    opIdx++
  }
  if (filters.provinceId) {
    operatorConditions.push(`rc.province_id = $${opIdx}::int`)
    operatorParams.push(filters.provinceId)
    opIdx++
  }
  if (filters.cityId) {
    operatorConditions.push(`addr.city_id = $${opIdx}::int`)
    operatorParams.push(filters.cityId)
    opIdx++
  }

  const [postRows, opRows] = await Promise.all([
    prisma.$queryRawUnsafe<{ name: string; posts: bigint }[]>(
      `${buildDailyReportedOperatorsCte(whereClause)}
       SELECT
         province AS name,
         COUNT(*) AS posts
       FROM daily_reported_operators
       WHERE province IS NOT NULL
       GROUP BY province`,
      ...params
    ),
    prisma.$queryRawUnsafe<{ name: string; operators: bigint }[]>(
      `SELECT
         rp.name AS name,
         COUNT(DISTINCT tu.id) AS operators
       FROM tenant_user tu
       INNER JOIN users u ON u.id = tu.user_id
       INNER JOIN model_has_roles mhr ON mhr.model_id = tu.id
       INNER JOIN roles r ON r.id = mhr.role_id
       LEFT JOIN LATERAL (
         SELECT a.city_id
         FROM addresses a
         WHERE a.tenant_id = tu.tenant_id
         ORDER BY a.id ASC
         LIMIT 1
       ) addr ON true
       LEFT JOIN reg_cities rc ON rc.id = addr.city_id
       LEFT JOIN reg_provinces rp ON rp.id = rc.province_id
       WHERE ${operatorConditions.join(' AND ')}
       GROUP BY rp.id, rp.name`,
      ...operatorParams
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
  const user = await requireManagerOrAdmin()
  filters = await scopeDashboardFilters(user, filters)
  const { whereClause, params } = buildBlogPostReportFilters(filters)

  const operatorConditions: string[] = [
    `mhr.model_type = 'App\\Models\\TenantUser'`,
    `mhr.model_id = tu.id`,
    `r.name = 'operator'`,
    `COALESCE(u.is_blocked, false) = false`,
    `rp.name IS NOT NULL`,
    `rc.name IS NOT NULL`,
  ]
  const operatorParams: unknown[] = []
  let opIdx = 1

  if (filters.tenantId) {
    operatorConditions.push(`tu.tenant_id = $${opIdx}::bigint`)
    operatorParams.push(filters.tenantId)
    opIdx++
  }
  if (filters.provinceId) {
    operatorConditions.push(`rc.province_id = $${opIdx}::int`)
    operatorParams.push(filters.provinceId)
    opIdx++
  }
  if (filters.cityId) {
    operatorConditions.push(`addr.city_id = $${opIdx}::int`)
    operatorParams.push(filters.cityId)
    opIdx++
  }

  const [postRows, opRows] = await Promise.all([
    prisma.$queryRawUnsafe<{ province: string; name: string; posts: bigint }[]>(
      `${buildDailyReportedOperatorsCte(whereClause)}
       SELECT
         province,
         city AS name,
         COUNT(*) AS posts
       FROM daily_reported_operators
       WHERE province IS NOT NULL
         AND city IS NOT NULL
       GROUP BY province, city`,
      ...params
    ),
    prisma.$queryRawUnsafe<{ province: string; name: string; operators: bigint }[]>(
      `SELECT
         rp.name AS province,
         rc.name AS name,
         COUNT(DISTINCT tu.id) AS operators
       FROM tenant_user tu
       INNER JOIN users u ON u.id = tu.user_id
       INNER JOIN model_has_roles mhr ON mhr.model_id = tu.id
       INNER JOIN roles r ON r.id = mhr.role_id
       LEFT JOIN LATERAL (
         SELECT a.city_id
         FROM addresses a
         WHERE a.tenant_id = tu.tenant_id
         ORDER BY a.id ASC
         LIMIT 1
       ) addr ON true
       LEFT JOIN reg_cities rc ON rc.id = addr.city_id
       LEFT JOIN reg_provinces rp ON rp.id = rc.province_id
       WHERE ${operatorConditions.join(' AND ')}
       GROUP BY rp.id, rp.name, rc.id, rc.name`,
      ...operatorParams
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
  const user = await requireManagerOrAdmin()
  filters = await scopeDashboardFilters(user, filters)
  const { whereClause, params } = buildBlogPostReportFilters(filters)

  const result = await prisma.$queryRawUnsafe<ReportRow[]>(
    `
    WITH report_posts AS (
      SELECT
        ${BLOG_POST_JAKARTA_DATE_SQL} AS tanggal_pelaporan,
        u.email,
        u.name AS nama_operator,
        u.phone_number AS no_hp,
        rp.name AS propinsi,
        rc.name AS kabupaten_kota,
        bp.id,
        bp.title,
        bp.source_url,
        bp.created_at,
        lower(COALESCE(c.name, '')) AS category_name,
        m.custom_properties ->> 'source_url' AS media_url
      FROM blog_posts bp
      INNER JOIN users u ON u.id = bp.user_id
      INNER JOIN tenant_user tu
        ON tu.user_id = bp.user_id
       AND tu.tenant_id = bp.tenant_id
      INNER JOIN model_has_roles mhr
        ON mhr.model_id = tu.id
       AND mhr.model_type = 'App\\Models\\TenantUser'
      INNER JOIN roles r
        ON r.id = mhr.role_id
       AND r.name = 'operator'
      LEFT JOIN LATERAL (
        SELECT a.city_id
        FROM addresses a
        WHERE a.tenant_id = tu.tenant_id
        ORDER BY a.id ASC
        LIMIT 1
      ) addr ON true
      LEFT JOIN reg_cities rc ON rc.id = addr.city_id
      LEFT JOIN reg_provinces rp ON rp.id = rc.province_id
      LEFT JOIN blog_post_categories c ON c.id = bp.blog_post_category_id
      LEFT JOIN media m
        ON m.model_type = 'App\\Models\\BlogPost'
       AND m.model_id = bp.id
       AND m.collection_name = 'blog-images'
      ${whereClause}
        AND COALESCE(u.is_blocked, false) = false
    ),
    numbered AS (
      SELECT
        *,
        CASE
          WHEN source_url = 'amplifikasi' THEN COUNT(*) FILTER (WHERE source_url = 'amplifikasi') OVER (
            PARTITION BY tanggal_pelaporan, email
            ORDER BY created_at ASC NULLS LAST, id ASC
            ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
          )
        END AS amplifikasi_index
      FROM report_posts
    )
    SELECT
      tanggal_pelaporan,
      email,
      nama_operator,
      no_hp,
      propinsi,
      kabupaten_kota,
      MAX(title) FILTER (WHERE source_url = 'upload' AND category_name LIKE '%tiktok%') AS tiktok_link,
      MAX(title) FILTER (WHERE source_url = 'upload' AND category_name LIKE '%instagram%') AS instagram_link,
      MAX(title) FILTER (WHERE source_url = 'upload' AND category_name LIKE '%facebook%') AS facebook_link,
      MAX(title) FILTER (WHERE source_url = 'upload' AND category_name LIKE '%youtube%') AS youtube_link,
      MAX(media_url) FILTER (WHERE source_url = 'amplifikasi' AND amplifikasi_index = 1) AS amplifikasi_1,
      MAX(media_url) FILTER (WHERE source_url = 'amplifikasi' AND amplifikasi_index = 2) AS amplifikasi_2,
      MAX(media_url) FILTER (WHERE source_url = 'amplifikasi' AND amplifikasi_index = 3) AS amplifikasi_3,
      MAX(media_url) FILTER (WHERE source_url = 'amplifikasi' AND amplifikasi_index = 4) AS amplifikasi_4
    FROM numbered
    GROUP BY tanggal_pelaporan, email, nama_operator, no_hp, propinsi, kabupaten_kota
    HAVING COUNT(*) FILTER (WHERE source_url = 'upload') > 0
       AND COUNT(*) FILTER (WHERE source_url = 'amplifikasi') > 0
    ORDER BY tanggal_pelaporan DESC, nama_operator
    `,
    ...params
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
  const user = await requireManagerOrAdmin()
  filters = await scopeDashboardFilters(user, filters)
  const { whereClause, params } = buildBlogPostReportFilters(filters)
  const result = await prisma.$queryRawUnsafe<{ date: string; value: bigint }[]>(
    `
    ${buildDailyReportedOperatorsCte(whereClause)}
    SELECT
      to_char(tanggal_pelaporan, 'YYYY-MM-DD') AS date,
      COUNT(*) AS value
    FROM daily_reported_operators
    GROUP BY tanggal_pelaporan
    ORDER BY date ASC
    `,
    ...params
  )

  return result.map((r) => ({
    name: new Date(`${r.date}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
    value: Number(r.value),
  }))
}

export async function getOperatorReportSummary(filters: DashboardFilters): Promise<OperatorReportSummary> {
  const user = await requireManagerOrAdmin()
  filters = await scopeDashboardFilters(user, filters)

  const operatorConditions: string[] = [
    `mhr.model_type = 'App\\Models\\TenantUser'`,
    `mhr.model_id = tu.id`,
    `r.name = 'operator'`,
    `COALESCE(u.is_blocked, false) = false`,
  ]
  const postConditions: string[] = []
  const params: unknown[] = []
  let idx = 1

  if (filters.tenantId) {
    operatorConditions.push(`tu.tenant_id = $${idx}::bigint`)
    params.push(filters.tenantId)
    idx++
  }
  if (filters.provinceId) {
    operatorConditions.push(`rc.province_id = $${idx}::int`)
    params.push(filters.provinceId)
    idx++
  }
  if (filters.cityId) {
    operatorConditions.push(`addr.city_id = $${idx}::int`)
    params.push(filters.cityId)
    idx++
  }
  if (filters.dateFrom) {
    postConditions.push(`date((bp.created_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Jakarta') >= $${idx}::date`)
    params.push(filters.dateFrom)
    idx++
  }
  if (filters.dateTo) {
    postConditions.push(`date((bp.created_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Jakarta') <= $${idx}::date`)
    params.push(filters.dateTo)
    idx++
  }
  if (filters.status) {
    postConditions.push(`bp.status::text = $${idx}::text`)
    params.push(filters.status)
    idx++
  }

  const postWhere = postConditions.length > 0 ? `AND ${postConditions.join(' AND ')}` : ''

  const rows = await prisma.$queryRawUnsafe<{
    tenant_user_id: bigint
    user_id: bigint
    name: string
    email: string
    phone_number: string | null
    province: string | null
    city: string | null
    upload_count: bigint
    amplifikasi_count: bigint
  }[]>(
    `
    WITH operator_scope AS (
      SELECT DISTINCT
        tu.id AS tenant_user_id,
        tu.user_id,
        tu.tenant_id,
        u.name,
        u.email,
        u.phone_number,
        rp.name AS province,
        rc.name AS city
      FROM tenant_user tu
      INNER JOIN users u ON u.id = tu.user_id
      INNER JOIN model_has_roles mhr ON mhr.model_id = tu.id
      INNER JOIN roles r ON r.id = mhr.role_id
      LEFT JOIN LATERAL (
        SELECT a.city_id
        FROM addresses a
        WHERE a.tenant_id = tu.tenant_id
        ORDER BY a.id ASC
        LIMIT 1
      ) addr ON true
      LEFT JOIN reg_cities rc ON rc.id = addr.city_id
      LEFT JOIN reg_provinces rp ON rp.id = rc.province_id
      WHERE ${operatorConditions.join(' AND ')}
    ),
    post_counts AS (
      SELECT
        bp.user_id,
        bp.tenant_id,
        COUNT(*) FILTER (WHERE bp.source_url = 'upload') AS upload_count,
        COUNT(*) FILTER (WHERE bp.source_url = 'amplifikasi') AS amplifikasi_count
      FROM blog_posts bp
      INNER JOIN operator_scope os
        ON os.user_id = bp.user_id
       AND os.tenant_id = bp.tenant_id
      WHERE bp.source_url IN ('upload', 'amplifikasi')
      ${postWhere}
      GROUP BY bp.user_id, bp.tenant_id
    )
    SELECT
      os.tenant_user_id,
      os.user_id,
      os.name,
      os.email,
      os.phone_number,
      os.province,
      os.city,
      COALESCE(pc.upload_count, 0)::bigint AS upload_count,
      COALESCE(pc.amplifikasi_count, 0)::bigint AS amplifikasi_count
    FROM operator_scope os
    LEFT JOIN post_counts pc
      ON pc.user_id = os.user_id
     AND pc.tenant_id = os.tenant_id
    ORDER BY os.province NULLS LAST, os.city NULLS LAST, os.name ASC
    `,
    ...params
  )

  const allRows = rows.map((row) => {
    const uploadCount = Number(row.upload_count)
    const amplifikasiCount = Number(row.amplifikasi_count)
    const hasReported = uploadCount > 0 && amplifikasiCount > 0
    return {
      tenantUserId: row.tenant_user_id.toString(),
      userId: row.user_id.toString(),
      name: row.name,
      email: row.email,
      phoneNumber: row.phone_number,
      province: row.province,
      city: row.city,
      uploadCount,
      amplifikasiCount,
      missingUpload: uploadCount === 0,
      missingAmplifikasi: amplifikasiCount === 0,
      hasReported,
    }
  })

  const reportedRows = allRows.filter((row) => row.hasReported)
  const missingRows = allRows.filter((row) => !row.hasReported)

  return {
    totalOperators: allRows.length,
    reportedOperators: reportedRows.length,
    missingOperators: missingRows.length,
    reportedRows,
    missingRows,
  }
}
