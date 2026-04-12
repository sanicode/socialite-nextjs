'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/app/lib/authorization'
import { getConfigValue, setConfigValue } from '@/app/lib/configs'
import { logEvent } from '@/app/lib/logger'
import { prisma } from '@/app/lib/prisma'

const LOGS_ENABLED_KEY = 'access_logs_enabled'

export async function isAccessLoggingEnabled(): Promise<boolean> {
  const value = await getConfigValue(LOGS_ENABLED_KEY)
  if (value === null) return true // default: aktif
  return value === '1'
}

export async function toggleAccessLogging(enabled: boolean): Promise<void> {
  const admin = await requireAdmin()
  await setConfigValue(LOGS_ENABLED_KEY, enabled ? '1' : '0')
  logEvent('warn', 'access_logs.toggle', { userId: admin.id, enabled })
  revalidatePath('/settings/logs')
}

export async function truncateAccessLogs(): Promise<{ deleted: number }> {
  const admin = await requireAdmin()
  const result = await prisma.$queryRaw<{ count: bigint }[]>`
    WITH deleted AS (DELETE FROM access_logs RETURNING 1)
    SELECT COUNT(*)::bigint AS count FROM deleted
  `
  const deleted = Number(result[0]?.count ?? 0)
  logEvent('warn', 'access_logs.truncated', { userId: admin.id, deleted })
  revalidatePath('/settings/logs')
  return { deleted }
}
