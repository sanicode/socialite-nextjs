import { prisma } from '@/app/lib/prisma'

export type StatistikFilters = {
  dateFrom?: string
  dateTo?: string
  provinceId?: string
  cityId?: string
  status?: 'pending' | 'valid' | 'invalid'
}

export type StatistikChartItem = {
  name: string
  value: number
}

export type StatistikProvinceChartItem = {
  name: string
  posts: number
  operators: number
}

export type StatistikCityChartGroup = {
  province: string
  cities: StatistikProvinceChartItem[]
}

export type StatistikOperatorReportRow = {
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

export type StatistikOperatorReportSummary = {
  totalOperators: number
  reportedOperators: number
  missingOperators: number
  reportedRows: StatistikOperatorReportRow[]
  missingRows: StatistikOperatorReportRow[]
}

export type StatistikDashboardPayload = {
  summary: StatistikOperatorReportSummary
  provinceData: StatistikProvinceChartItem[]
  cityData: StatistikCityChartGroup[]
  dailyData: StatistikChartItem[]
}

const BLOG_POST_JAKARTA_DATE_SQL = `date((bp.created_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Jakarta')`

function buildBlogPostReportFilters(filters: StatistikFilters) {
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

export function getJakartaDateString(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

export function normalizeStatistikFilters(filters: StatistikFilters): Required<Pick<StatistikFilters, 'dateFrom' | 'dateTo'>> & StatistikFilters {
  const today = getJakartaDateString()
  const rawFrom = filters.dateFrom ?? today
  const rawTo = filters.dateTo ?? today
  const fromDate = new Date(rawFrom)
  const maxToDate = new Date(fromDate)
  maxToDate.setMonth(maxToDate.getMonth() + 1)
  const toDate = new Date(rawTo)
  const clampedTo = toDate > maxToDate ? maxToDate.toISOString().slice(0, 10) : rawTo

  return {
    dateFrom: rawFrom,
    dateTo: clampedTo,
    provinceId: filters.provinceId,
    cityId: filters.cityId,
    status: filters.status,
  }
}

export async function getStatistikProvinces(): Promise<{ id: number; name: string }[]> {
  const provinces = await prisma.reg_provinces.findMany({ orderBy: { name: 'asc' } })
  return provinces.map((province) => ({ id: province.id, name: province.name }))
}

export async function getStatistikCities(provinceId?: string): Promise<{ id: string; name: string }[]> {
  const where = provinceId ? { province_id: parseInt(provinceId, 10) } : {}
  const cities = await prisma.reg_cities.findMany({ where, orderBy: { name: 'asc' } })
  return cities.map((city) => ({ id: city.id.toString(), name: city.name }))
}

async function getOperatorReportSummary(filters: StatistikFilters): Promise<StatistikOperatorReportSummary> {
  const operatorConditions: string[] = [
    `mhr.model_type = 'App\\Models\\TenantUser'`,
    `mhr.model_id = tu.id`,
    `r.name = 'operator'`,
    `COALESCE(u.is_blocked, false) = false`,
  ]
  const postConditions: string[] = []
  const params: unknown[] = []
  let idx = 1

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
    postConditions.push(`${BLOG_POST_JAKARTA_DATE_SQL} >= $${idx}::date`)
    params.push(filters.dateFrom)
    idx++
  }
  if (filters.dateTo) {
    postConditions.push(`${BLOG_POST_JAKARTA_DATE_SQL} <= $${idx}::date`)
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

async function getProvinceChartData(filters: StatistikFilters): Promise<StatistikProvinceChartItem[]> {
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

  if (filters.provinceId) {
    operatorConditions.push(`rc.province_id = $${opIdx}::int`)
    operatorParams.push(filters.provinceId)
    opIdx++
  }
  if (filters.cityId) {
    operatorConditions.push(`addr.city_id = $${opIdx}::int`)
    operatorParams.push(filters.cityId)
  }

  const [postRows, opRows] = await Promise.all([
    prisma.$queryRawUnsafe<{ name: string; posts: bigint }[]>(
      `${buildDailyReportedOperatorsCte(whereClause)}
       SELECT province AS name, COUNT(*) AS posts
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

  const opMap = new Map(opRows.map((row) => [row.name, Number(row.operators)]))
  const postMap = new Map(postRows.map((row) => [row.name, Number(row.posts)]))
  const allNames = new Set([...postMap.keys(), ...opMap.keys()])
  return Array.from(allNames).map((name) => ({
    name,
    posts: postMap.get(name) ?? 0,
    operators: opMap.get(name) ?? 0,
  })).sort((a, b) => {
    const ratioB = b.operators > 0 ? b.posts / b.operators : b.posts
    const ratioA = a.operators > 0 ? a.posts / a.operators : a.posts
    return ratioB - ratioA
  })
}

async function getTopCitiesByPosts(filters: StatistikFilters): Promise<StatistikCityChartGroup[]> {
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

  if (filters.provinceId) {
    operatorConditions.push(`rc.province_id = $${opIdx}::int`)
    operatorParams.push(filters.provinceId)
    opIdx++
  }
  if (filters.cityId) {
    operatorConditions.push(`addr.city_id = $${opIdx}::int`)
    operatorParams.push(filters.cityId)
  }

  const [postRows, opRows] = await Promise.all([
    prisma.$queryRawUnsafe<{ province: string; name: string; posts: bigint }[]>(
      `${buildDailyReportedOperatorsCte(whereClause)}
       SELECT province, city AS name, COUNT(*) AS posts
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

  const map = new Map<string, Map<string, { posts: number; operators: number }>>()
  for (const row of postRows) {
    if (!map.has(row.province)) map.set(row.province, new Map())
    const cities = map.get(row.province)!
    const current = cities.get(row.name) ?? { posts: 0, operators: 0 }
    cities.set(row.name, { ...current, posts: Number(row.posts) })
  }
  for (const row of opRows) {
    if (!map.has(row.province)) map.set(row.province, new Map())
    const cities = map.get(row.province)!
    const current = cities.get(row.name) ?? { posts: 0, operators: 0 }
    cities.set(row.name, { ...current, operators: Number(row.operators) })
  }

  return Array.from(map.entries()).map(([province, cities]) => {
    const items = Array.from(cities.entries()).map(([name, data]) => ({
      name,
      posts: data.posts,
      operators: data.operators,
    })).sort((a, b) => {
      const ratioB = b.operators > 0 ? b.posts / b.operators : b.posts
      const ratioA = a.operators > 0 ? a.posts / a.operators : a.posts
      return ratioB - ratioA
    })
    return { province, cities: items }
  }).sort((a, b) => a.province.localeCompare(b.province))
}

async function getPostsByDate(filters: StatistikFilters): Promise<StatistikChartItem[]> {
  const { whereClause, params } = buildBlogPostReportFilters(filters)
  const rows = await prisma.$queryRawUnsafe<{ date: string; value: bigint }[]>(
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

  return rows.map((row) => ({
    name: new Date(`${row.date}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
    value: Number(row.value),
  }))
}

export async function getStatistikDashboardData(filters: StatistikFilters): Promise<StatistikDashboardPayload> {
  const normalizedFilters = normalizeStatistikFilters(filters)
  const [summary, provinceData, cityData, dailyData] = await Promise.all([
    getOperatorReportSummary(normalizedFilters),
    getProvinceChartData(normalizedFilters),
    getTopCitiesByPosts(normalizedFilters),
    getPostsByDate(normalizedFilters),
  ])

  return {
    summary,
    provinceData,
    cityData,
    dailyData,
  }
}
