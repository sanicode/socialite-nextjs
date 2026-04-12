import { headers } from 'next/headers'
import { prisma } from '@/app/lib/prisma'
import { logEvent } from '@/app/lib/logger'
import { getConfigValue } from '@/app/lib/configs'

export type AccessLogEntry = {
  eventType: string
  status: string
  requestPath?: string | null
  method?: string | null
  ip?: string | null
  country?: string | null
  userId?: string | null
  userEmail?: string | null
  userAgent?: string | null
  browser?: string | null
  os?: string | null
  deviceType?: string | null
  referer?: string | null
  requestId?: string | null
  details?: Record<string, unknown> | null
}

export type AccessLogRow = {
  id: string
  created_at: string
  event_type: string
  request_path: string | null
  method: string | null
  status: string
  ip: string | null
  country: string | null
  user_id: string | null
  user_email: string | null
  user_agent: string | null
  browser: string | null
  os: string | null
  device_type: string | null
  referer: string | null
  request_id: string | null
  details: Record<string, unknown> | null
}

function parseBrowser(userAgent: string): string {
  if (/Edg\//i.test(userAgent)) return 'Edge'
  if (/OPR\//i.test(userAgent)) return 'Opera'
  if (/Chrome\//i.test(userAgent) && !/Edg\//i.test(userAgent)) return 'Chrome'
  if (/Firefox\//i.test(userAgent)) return 'Firefox'
  if (/Safari\//i.test(userAgent) && !/Chrome\//i.test(userAgent)) return 'Safari'
  return 'Unknown'
}

function parseOs(userAgent: string): string {
  if (/Windows NT/i.test(userAgent)) return 'Windows'
  if (/Mac OS X/i.test(userAgent)) return 'macOS'
  if (/Android/i.test(userAgent)) return 'Android'
  if (/(iPhone|iPad|iPod)/i.test(userAgent)) return 'iOS'
  if (/Linux/i.test(userAgent)) return 'Linux'
  return 'Unknown'
}

function parseDeviceType(userAgent: string): string {
  if (/(iPad|Tablet)/i.test(userAgent)) return 'tablet'
  if (/(Mobile|iPhone|Android)/i.test(userAgent)) return 'mobile'
  return 'desktop'
}

export async function getRequestMetadata() {
  const headerStore = await headers()
  const forwardedFor = headerStore.get('x-forwarded-for')?.split(',')[0]?.trim()
  const realIp = headerStore.get('x-real-ip')?.trim()
  const cloudflareIp = headerStore.get('cf-connecting-ip')?.trim()
  const ip = forwardedFor || realIp || cloudflareIp || null
  const country =
    headerStore.get('cf-ipcountry')?.trim() ||
    headerStore.get('x-vercel-ip-country')?.trim() ||
    headerStore.get('x-country-code')?.trim() ||
    headerStore.get('x-geo-country')?.trim() ||
    null
  const userAgent = headerStore.get('user-agent')?.trim() || null
  const referer = headerStore.get('referer')?.trim() || null
  const requestPath = headerStore.get('x-request-path')?.trim() || null
  const method = headerStore.get('x-request-method')?.trim() || null
  const requestId = headerStore.get('x-request-id')?.trim() || null

  return {
    ip,
    country,
    userAgent,
    referer,
    requestPath,
    method,
    requestId,
    browser: userAgent ? parseBrowser(userAgent) : null,
    os: userAgent ? parseOs(userAgent) : null,
    deviceType: userAgent ? parseDeviceType(userAgent) : null,
  }
}

export async function writeAccessLog(entry: AccessLogEntry): Promise<void> {
  try {
    const logsEnabled = await getConfigValue('access_logs_enabled')
    if (logsEnabled === '0') return

    const requestMetadata = await getRequestMetadata()
    const finalEntry = {
      ...requestMetadata,
      ...entry,
      details: entry.details ?? null,
    }

    await prisma.$executeRawUnsafe(
      `INSERT INTO access_logs (
        event_type,
        request_path,
        method,
        status,
        ip,
        country,
        user_id,
        user_email,
        user_agent,
        browser,
        os,
        device_type,
        referer,
        request_id,
        details,
        created_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7::bigint, $8, $9, $10, $11, $12, $13, $14, $15::jsonb, NOW()
      )`,
      finalEntry.eventType,
      finalEntry.requestPath,
      finalEntry.method,
      finalEntry.status,
      finalEntry.ip,
      finalEntry.country,
      finalEntry.userId ? BigInt(finalEntry.userId) : null,
      finalEntry.userEmail,
      finalEntry.userAgent,
      finalEntry.browser,
      finalEntry.os,
      finalEntry.deviceType,
      finalEntry.referer,
      finalEntry.requestId,
      JSON.stringify(finalEntry.details)
    )
  } catch (error) {
    logEvent('error', 'access_logs.write_failed', { error, eventType: entry.eventType })
  }
}

export async function getAccessLogs(params: {
  page?: number
  pageSize?: number
  search?: string
  eventType?: string
  country?: string
  path?: string
  dateFrom?: string
  dateTo?: string
}): Promise<{ rows: AccessLogRow[]; total: number }> {
  const page = params.page ?? 1
  const pageSize = params.pageSize ?? 50
  const offset = (page - 1) * pageSize

  const conditions: string[] = []
  const values: unknown[] = []
  let index = 1

  if (params.search) {
    conditions.push(`(ip ILIKE $${index} OR COALESCE(user_email, '') ILIKE $${index} OR COALESCE(user_agent, '') ILIKE $${index})`)
    values.push(`%${params.search}%`)
    index++
  }

  if (params.eventType) {
    conditions.push(`event_type = $${index}`)
    values.push(params.eventType)
    index++
  }

  if (params.country) {
    conditions.push(`country = $${index}`)
    values.push(params.country.toUpperCase())
    index++
  }

  if (params.path) {
    conditions.push(`request_path ILIKE $${index}`)
    values.push(`%${params.path}%`)
    index++
  }

  if (params.dateFrom) {
    conditions.push(`created_at >= $${index}::date`)
    values.push(params.dateFrom)
    index++
  }

  if (params.dateTo) {
    conditions.push(`created_at <= ($${index}::date + interval '1 day' - interval '1 second')`)
    values.push(params.dateTo)
    index++
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  const totalResult = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
    `SELECT COUNT(*)::bigint AS count FROM access_logs ${whereClause}`,
    ...values
  )

  const rows = await prisma.$queryRawUnsafe<AccessLogRow[]>(
    `SELECT
      id::text,
      created_at::text,
      event_type,
      request_path,
      method,
      status,
      ip,
      country,
      user_id::text,
      user_email,
      user_agent,
      browser,
      os,
      device_type,
      referer,
      request_id,
      details
     FROM access_logs
     ${whereClause}
     ORDER BY created_at DESC
     LIMIT $${index} OFFSET $${index + 1}`,
    ...values,
    pageSize,
    offset
  )

  return {
    rows,
    total: Number(totalResult[0]?.count ?? 0),
  }
}

