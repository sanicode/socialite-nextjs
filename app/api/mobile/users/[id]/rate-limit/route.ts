import { requireJwtRole, apiError, requireApiEnabled } from '@/app/lib/api-auth'
import { prisma } from '@/app/lib/prisma'
import { logEvent } from '@/app/lib/logger'

type Ctx = { params: Promise<{ id: string }> }

export async function DELETE(request: Request, { params }: Ctx) {
  try {
    await requireApiEnabled()
    const admin = await requireJwtRole(request, 'admin')
    const { id } = await params

    const user = await prisma.users.findUnique({
      where: { id: BigInt(id) },
      select: { email: true },
    })
    if (!user) return Response.json({ error: 'User tidak ditemukan' }, { status: 404 })

    await prisma.$executeRaw`
      DELETE FROM login_attempts WHERE email = ${user.email}
    `

    logEvent('warn', 'user.rate_limit_reset', { adminId: admin.sub, email: user.email })
    return Response.json({ success: true })
  } catch (error) {
    return apiError(error)
  }
}
