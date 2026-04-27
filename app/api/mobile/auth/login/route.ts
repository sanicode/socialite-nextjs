import bcrypt from 'bcryptjs'
import { prisma } from '@/app/lib/prisma'
import { signJwt } from '@/app/lib/jwt'
import { apiError, ApiError, requireApiEnabled } from '@/app/lib/api-auth'
import { getUserRoles } from '@/app/lib/permissions'

export async function POST(request: Request) {
  try {
    await requireApiEnabled()
    const body = await request.json()
    const { email, password } = body

    if (!email || !password) {
      throw new ApiError(400, 'Email dan password wajib diisi')
    }

    const user = await prisma.users.findFirst({
      where: { email: String(email) },
      select: { id: true, name: true, email: true, phone_number: true, password: true, is_admin: true, is_blocked: true },
    })

    if (!user) {
      throw new ApiError(401, 'Email atau password salah')
    }

    if (user.is_blocked) {
      throw new ApiError(403, 'Akun Anda telah diblokir')
    }

    const valid = await bcrypt.compare(String(password), user.password ?? '')
    if (!valid) {
      throw new ApiError(401, 'Email atau password salah')
    }

    const roles = await getUserRoles(user.id.toString())

    const token = signJwt({
      sub: user.id.toString(),
      email: user.email,
      roles,
    })

    return Response.json({
      token,
      user: {
        id: user.id.toString(),
        name: user.name,
        email: user.email,
        phone_number: user.phone_number,
        is_admin: user.is_admin,
        roles,
      },
    })
  } catch (error) {
    return apiError(error)
  }
}
