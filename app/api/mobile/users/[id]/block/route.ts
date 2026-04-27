import { requireJwtRole, apiError, ApiError, requireApiEnabled } from '@/app/lib/api-auth'
import { prisma } from '@/app/lib/prisma'
import { logEvent } from '@/app/lib/logger'

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, { params }: Ctx) {
  try {
    await requireApiEnabled()
    const admin = requireJwtRole(request, 'admin')
    const { id } = await params
    const body = await request.json()

    if (typeof body.block !== 'boolean') {
      throw new ApiError(400, 'Field "block" harus berupa boolean.')
    }

    await prisma.users.update({
      where: { id: BigInt(id) },
      data: { is_blocked: body.block },
    })

    logEvent('warn', 'user.block_toggled', { adminId: admin.sub, userId: id, block: body.block })
    return Response.json({ success: true })
  } catch (error) {
    return apiError(error)
  }
}
