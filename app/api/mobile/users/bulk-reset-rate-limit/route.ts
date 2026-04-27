import { requireJwtRole, apiError, ApiError, requireApiEnabled } from '@/app/lib/api-auth'
import { prisma } from '@/app/lib/prisma'
import { logEvent } from '@/app/lib/logger'

export async function POST(request: Request) {
  try {
    await requireApiEnabled()
    const admin = requireJwtRole(request, 'admin')
    const body = await request.json()

    const { emails } = body
    if (!Array.isArray(emails) || emails.length === 0) {
      throw new ApiError(400, 'emails harus berupa array yang tidak kosong.')
    }

    await prisma.$executeRaw`
      DELETE FROM login_attempts
      WHERE email = ANY(${emails}::text[])
    `

    logEvent('warn', 'user.bulk_rate_limit_reset', { adminId: admin.sub, count: emails.length, emails })
    return Response.json({ count: emails.length })
  } catch (error) {
    return apiError(error)
  }
}
