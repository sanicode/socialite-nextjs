import { Prisma } from '@/app/generated/prisma/client'
import { prisma } from '@/app/lib/prisma'

export type OperatorReportKind = 'upload' | 'amplifikasi'

export class OperatorReportDailyLimitError extends Error {
  constructor(
    public readonly reportKind: OperatorReportKind,
    public readonly limit: number,
  ) {
    super(getOperatorReportDailyLimitMessage(reportKind, limit))
    this.name = 'OperatorReportDailyLimitError'
  }
}

function getJakartaDateString(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function getJakartaDateBounds(dateString: string, endOfDay: boolean) {
  return new Date(`${dateString}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}+07:00`)
}

export function getOperatorReportDailyLimitMessage(reportKind: OperatorReportKind, limit: number) {
  if (limit === 0) {
    return `Belum ada jenis medsos aktif. Laporan ${reportKind} belum dapat ditambahkan.`
  }

  return `Batas ${reportKind} hari ini sudah tercapai. Maksimal ${limit} laporan per hari sesuai jumlah jenis medsos aktif.`
}

export async function withOperatorReportDailyLimit<T>(
  userId: string | bigint,
  reportKind: OperatorReportKind,
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  const normalizedUserId = userId.toString()
  const today = getJakartaDateString()
  const startOfDay = getJakartaDateBounds(today, false)
  const endOfDay = getJakartaDateBounds(today, true)

  return prisma.$transaction(async (tx) => {
    const lockKey = `operator-report-daily-limit:${normalizedUserId}:${reportKind}:${today}`
    await tx.$queryRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))::text', lockKey)

    const [limit, reportCount] = await Promise.all([
      tx.blog_post_categories.count({
        where: {
          is_active: true,
          deleted_at: null,
        },
      }),
      tx.blog_posts.count({
        where: {
          user_id: BigInt(normalizedUserId),
          source_url: reportKind,
          deleted_at: null,
          created_at: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
      }),
    ])

    if (reportCount >= limit) {
      throw new OperatorReportDailyLimitError(reportKind, limit)
    }

    return operation(tx)
  })
}
