import { prisma } from '@/app/lib/prisma'

export const AMPLIFIKASI_DAILY_LIMIT = 4

export function getJakartaDateString(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

export async function countUserAmplifikasiToday(userId: string | bigint): Promise<number> {
  const today = getJakartaDateString()
  const result = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
    `
    SELECT COUNT(*)::bigint AS count
    FROM blog_posts
    WHERE user_id = $1::bigint
      AND source_url = 'amplifikasi'
      AND date((created_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Jakarta') = $2::date
    `,
    userId.toString(),
    today
  )

  return Number(result[0]?.count ?? 0)
}
