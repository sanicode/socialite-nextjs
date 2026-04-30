import { requireJwtRole, apiError, requireApiEnabled } from '@/app/lib/api-auth'
import { getAccessLogs } from '@/app/lib/access-logs'
import { prisma } from '@/app/lib/prisma'
import { getConfigValue } from '@/app/lib/configs'
import { logEvent } from '@/app/lib/logger'

// ── GET /api/mobile/settings/logs ────────────────────────────────────────────

export async function GET(request: Request) {
  try {
    await requireApiEnabled()
    await requireJwtRole(request, 'admin')
    const { searchParams } = new URL(request.url)

    const page      = Math.max(1, Number(searchParams.get('page') ?? '1') || 1)
    const pageSize  = Math.min(100, Math.max(1, Number(searchParams.get('pageSize') ?? '50') || 50))
    const search    = searchParams.get('search') ?? undefined
    const eventType = searchParams.get('eventType') ?? undefined
    const country   = searchParams.get('country') ?? undefined
    const path      = searchParams.get('path') ?? undefined
    const dateFrom  = searchParams.get('dateFrom') ?? undefined
    const dateTo    = searchParams.get('dateTo') ?? undefined

    const [logsEnabled, { rows, total }] = await Promise.all([
      getConfigValue('access_logs_enabled').then((v) => v === null ? true : v === '1'),
      getAccessLogs({ page, pageSize, search, eventType, country, path, dateFrom, dateTo }),
    ])

    return Response.json({ rows, total, logsEnabled })
  } catch (error) {
    return apiError(error)
  }
}

// ── DELETE /api/mobile/settings/logs ─────────────────────────────────────────

export async function DELETE(request: Request) {
  try {
    await requireApiEnabled()
    const admin = await requireJwtRole(request, 'admin')

    const result = await prisma.$queryRaw<{ count: bigint }[]>`
      WITH deleted AS (DELETE FROM access_logs RETURNING 1)
      SELECT COUNT(*)::bigint AS count FROM deleted
    `
    const deleted = Number(result[0]?.count ?? 0)

    logEvent('warn', 'access_logs.truncated', { userId: admin.sub, deleted })
    return Response.json({ deleted })
  } catch (error) {
    return apiError(error)
  }
}
