'use server'

import { redirect } from 'next/navigation'
import bcrypt from 'bcryptjs'
import { prisma } from '@/app/lib/prisma'
import { createSession, deleteSession } from '@/app/lib/session'
import { logEvent } from '@/app/lib/logger'
import { getRequestSecurityDecision } from '@/app/lib/request-security'
import { writeAccessLog } from '@/app/lib/access-logs'
import {
  getLoginIp,
  checkRateLimit,
  recordLoginFailure,
  clearLoginFailures,
} from '@/app/lib/login-rate-limit'

export type LoginFormState =
  | {
      errors?: {
        email?: string[]
        password?: string[]
      }
      message?: string
      retryAfter?: number // detik tersisa sebelum boleh mencoba lagi
    }
  | undefined

export async function login(
  state: LoginFormState,
  formData: FormData
): Promise<LoginFormState> {
  const decision = await getRequestSecurityDecision()
  if (!decision.allowed) {
    logEvent('warn', 'auth.login.blocked_by_security_policy', {
      ip: decision.ip,
      country: decision.country,
      reason: decision.reason,
    })
    await writeAccessLog({
      eventType: 'login_blocked',
      status: 'blocked',
      ip: decision.ip,
      country: decision.country,
      userEmail: typeof formData.get('email') === 'string' ? String(formData.get('email')) : null,
      details: { reason: decision.reason },
    })
    return { message: decision.message ?? 'Akses login ditolak oleh kebijakan keamanan.' }
  }

  const email    = formData.get('email') as string
  const password = formData.get('password') as string

  const errors: { email?: string[]; password?: string[] } = {}

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = ['Masukkan alamat email yang valid.']
  }

  if (!password || password.length < 1) {
    errors.password = ['Password tidak boleh kosong.']
  }

  if (Object.keys(errors).length > 0) {
    return { errors }
  }

  const ip        = await getLoginIp()
  const rateLimit = await checkRateLimit(email, ip)

  if (rateLimit.blocked) {
    logEvent('warn', 'auth.login.rate_limited', { email, ip })
    await writeAccessLog({
      eventType: 'login_rate_limited',
      status: 'blocked',
      userEmail: email,
      details: { reason: 'rate_limited', retryAfterSeconds: rateLimit.retryAfterSeconds },
    })
    return {
      message: 'Terlalu banyak percobaan login gagal. Silakan coba lagi setelah beberapa saat.',
      retryAfter: rateLimit.retryAfterSeconds,
    }
  }

  const user = await prisma.users.findUnique({
    where: { email },
    select: { id: true, email: true, name: true, password: true, is_blocked: true },
  })

  // Cek password
  let passwordMatch = false
  if (user && !user.is_blocked) {
    passwordMatch = await bcrypt.compare(password, user.password)
  }

  if (!user || user.is_blocked || !passwordMatch) {
    await recordLoginFailure(email, ip)

    if (user && user.is_blocked) {
      logEvent('warn', 'auth.login.blocked_user', { email, userId: user.id.toString() })
      await writeAccessLog({
        eventType: 'login_failed',
        status: 'blocked',
        userId: user.id.toString(),
        userEmail: email,
        details: { reason: 'user_blocked' },
      })
      return { message: 'Akun Anda telah diblokir. Hubungi administrator.' }
    }

    logEvent('warn', 'auth.login.failed', { email, ip })
    await writeAccessLog({
      eventType: 'login_failed',
      status: 'failed',
      userEmail: email,
      details: { reason: 'invalid_credentials' },
    })
    return { message: 'Email atau password salah.' }
  }

  await clearLoginFailures(email, ip)
  await createSession(user.id.toString())
  logEvent('info', 'auth.login.succeeded', { email, userId: user.id.toString() })
  await writeAccessLog({
    eventType: 'login_success',
    status: 'success',
    userId: user.id.toString(),
    userEmail: email,
  })
  redirect('/dashboard')
}

export async function logout(): Promise<void> {
  await deleteSession()
  logEvent('info', 'auth.logout', {})
  await writeAccessLog({
    eventType: 'logout',
    status: 'success',
  })
  redirect('/login')
}
