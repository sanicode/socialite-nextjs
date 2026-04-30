import bcrypt from 'bcryptjs'
import { requireJwtRole, apiError, ApiError, requireApiEnabled } from '@/app/lib/api-auth'
import { prisma } from '@/app/lib/prisma'
import { logEvent } from '@/app/lib/logger'
import type { Prisma } from '@/app/generated/prisma/client'

const MODEL_TYPE_USER = 'App\\Models\\User'
type Ctx = { params: Promise<{ id: string }> }

// ── GET /api/mobile/users/[id] ────────────────────────────────────────────────

export async function GET(request: Request, { params }: Ctx) {
  try {
    await requireApiEnabled()
    await requireJwtRole(request, 'admin')
    const { id } = await params

    const user = await prisma.users.findUnique({
      where: { id: BigInt(id) },
      select: { id: true, name: true, email: true, phone_number: true, is_blocked: true, is_admin: true, last_seen_at: true },
    })
    if (!user) return Response.json({ error: 'User tidak ditemukan' }, { status: 404 })

    const role = await prisma.model_has_roles.findFirst({
      where: { model_type: MODEL_TYPE_USER, model_id: BigInt(id) },
      include: { roles: { select: { id: true, name: true } } },
    })

    return Response.json({
      id: user.id.toString(),
      name: user.name,
      email: user.email,
      phone_number: user.phone_number ?? null,
      is_blocked: user.is_blocked,
      is_admin: user.is_admin,
      last_seen_at: user.last_seen_at?.toISOString() ?? null,
      direct_role_id: role ? role.role_id.toString() : null,
      direct_role_name: role ? role.roles.name : null,
    })
  } catch (error) {
    return apiError(error)
  }
}

// ── PUT /api/mobile/users/[id] ────────────────────────────────────────────────

export async function PUT(request: Request, { params }: Ctx) {
  try {
    await requireApiEnabled()
    const admin = await requireJwtRole(request, 'admin')
    const { id } = await params
    const body = await request.json()

    const name  = (body.name ?? '').trim()
    const email = (body.email ?? '').trim().toLowerCase()
    const phone = (body.phone_number ?? '').trim()

    if (!name)  throw new ApiError(422, 'Nama tidak boleh kosong.')
    if (!email) throw new ApiError(422, 'Email tidak boleh kosong.')
    if (!phone) throw new ApiError(422, 'Nomor telp tidak boleh kosong.')

    const duplicate = await prisma.users.findFirst({
      where: { email, NOT: { id: BigInt(id) } },
    })
    if (duplicate) throw new ApiError(409, 'Email sudah digunakan user lain.')

    const updateData: Prisma.usersUpdateInput = {
      name,
      email,
      phone_number: phone,
      is_admin: body.is_admin ?? false,
    }
    if ((body.password ?? '').trim()) {
      updateData.password = await bcrypt.hash(body.password.trim(), 12)
    }

    await prisma.users.update({ where: { id: BigInt(id) }, data: updateData })

    await prisma.model_has_roles.deleteMany({
      where: { model_type: MODEL_TYPE_USER, model_id: BigInt(id) },
    })
    if (body.role_id) {
      await prisma.model_has_roles.create({
        data: { role_id: BigInt(body.role_id), model_type: MODEL_TYPE_USER, model_id: BigInt(id) },
      })
    }

    logEvent('info', 'user.updated', { adminId: admin.sub, userId: id, email })
    return Response.json({ success: true })
  } catch (error) {
    return apiError(error)
  }
}
