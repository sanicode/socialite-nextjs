import { requireJwtRole, apiError, ApiError, requireApiEnabled } from '@/app/lib/api-auth'
import { prisma } from '@/app/lib/prisma'
import { logEvent } from '@/app/lib/logger'

export async function POST(request: Request) {
  try {
    await requireApiEnabled()
    const admin = await requireJwtRole(request, 'admin')
    const body = await request.json()

    const { ids, block } = body
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new ApiError(400, 'ids harus berupa array yang tidak kosong.')
    }
    if (typeof block !== 'boolean') {
      throw new ApiError(400, 'block harus berupa boolean.')
    }

    const result = await prisma.users.updateMany({
      where: { id: { in: ids.map((id: string) => BigInt(id)) } },
      data: { is_blocked: block },
    })

    logEvent('warn', 'user.bulk_block_toggled', { adminId: admin.sub, count: result.count, block })
    return Response.json({ count: result.count })
  } catch (error) {
    return apiError(error)
  }
}
