import bcrypt from 'bcryptjs'
import { prisma } from '@/app/lib/prisma'
import { signJwt } from '@/app/lib/jwt'
import { apiError, ApiError, requireApiEnabled } from '@/app/lib/api-auth'
import { getUserRoles } from '@/app/lib/permissions'
import { getRequestSecurityDecision } from '@/app/lib/request-security'
import { writeAccessLog } from '@/app/lib/access-logs'
import { logEvent } from '@/app/lib/logger'
import {
  checkRateLimit,
  clearLoginFailures,
  getLoginIp,
  recordLoginFailure,
} from '@/app/lib/login-rate-limit'

export async function POST(request: Request) {
  try {
    await requireApiEnabled()
    const body = await request.json()
    const { email, password } = body
    const normalizedEmail = String(email ?? '').trim()

    const decision = await getRequestSecurityDecision()
    if (!decision.allowed) {
      logEvent('warn', 'mobile.auth.login.blocked_by_security_policy', {
        ip: decision.ip,
        country: decision.country,
        reason: decision.reason,
      })
      await writeAccessLog({
        eventType: 'login_blocked',
        status: 'blocked',
        ip: decision.ip,
        country: decision.country,
        userEmail: normalizedEmail || null,
        details: { channel: 'mobile', reason: decision.reason },
      })
      throw new ApiError(403, decision.message ?? 'Akses login ditolak oleh kebijakan keamanan.')
    }

    if (!email || !password) {
      throw new ApiError(400, 'Email dan password wajib diisi')
    }

    const ip = await getLoginIp()
    const rateLimit = await checkRateLimit(normalizedEmail, ip)
    if (rateLimit.blocked) {
      logEvent('warn', 'mobile.auth.login.rate_limited', { email: normalizedEmail, ip })
      await writeAccessLog({
        eventType: 'login_rate_limited',
        status: 'blocked',
        userEmail: normalizedEmail,
        details: { channel: 'mobile', retryAfterSeconds: rateLimit.retryAfterSeconds },
      })
      throw new ApiError(429, 'Terlalu banyak percobaan login gagal. Silakan coba lagi setelah beberapa saat.')
    }

    const user = await prisma.users.findFirst({
      where: { email: normalizedEmail },
      select: { id: true, name: true, email: true, phone_number: true, password: true, is_admin: true, is_blocked: true },
    })

    if (!user) {
      await recordLoginFailure(normalizedEmail, ip)
      await writeAccessLog({
        eventType: 'login_failed',
        status: 'failed',
        userEmail: normalizedEmail,
        details: { channel: 'mobile', reason: 'invalid_credentials' },
      })
      throw new ApiError(401, 'Email atau password salah')
    }

    if (user.is_blocked) {
      await recordLoginFailure(normalizedEmail, ip)
      await writeAccessLog({
        eventType: 'login_failed',
        status: 'blocked',
        userId: user.id.toString(),
        userEmail: user.email,
        details: { channel: 'mobile', reason: 'user_blocked' },
      })
      throw new ApiError(403, 'Akun Anda telah diblokir')
    }

    const valid = await bcrypt.compare(String(password), user.password ?? '')
    if (!valid) {
      await recordLoginFailure(normalizedEmail, ip)
      await writeAccessLog({
        eventType: 'login_failed',
        status: 'failed',
        userId: user.id.toString(),
        userEmail: user.email,
        details: { channel: 'mobile', reason: 'invalid_credentials' },
      })
      throw new ApiError(401, 'Email atau password salah')
    }

    await clearLoginFailures(normalizedEmail, ip)
    const roles = await getUserRoles(user.id.toString())

    const token = signJwt({
      sub: user.id.toString(),
      email: user.email,
      roles,
    })

    await writeAccessLog({
      eventType: 'login_success',
      status: 'success',
      userId: user.id.toString(),
      userEmail: user.email,
      details: { channel: 'mobile' },
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
