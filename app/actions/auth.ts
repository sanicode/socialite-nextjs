'use server'


import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import bcrypt from 'bcryptjs'
import { prisma } from '@/app/lib/prisma'
import { createSession, deleteSession } from '@/app/lib/session'
import { logEvent } from '@/app/lib/logger'


const LOGIN_ATTEMPTS = new Map<string, { count: number; firstAttemptAt: number; blockedUntil?: number }>()
const MAX_ATTEMPTS = 5
const WINDOW_MS = 10 * 60 * 1000

async function getRateLimitKey(email: string): Promise<string> {
  const headerStore = await headers()
  const forwardedFor = headerStore.get('x-forwarded-for')?.split(',')[0]?.trim()
  const realIp = headerStore.get('x-real-ip')?.trim()
  const ip = forwardedFor || realIp || 'unknown'
  return `${email.toLowerCase()}|${ip}`
}

function isRateLimited(key: string): boolean {
  const now = Date.now()
  const attempt = LOGIN_ATTEMPTS.get(key)
  if (!attempt) return false

  if (attempt.blockedUntil && attempt.blockedUntil > now) {
    return true
  }

  if (attempt.blockedUntil && attempt.blockedUntil <= now) {
    LOGIN_ATTEMPTS.delete(key)
    return false
  }

  if (now - attempt.firstAttemptAt > WINDOW_MS) {
    LOGIN_ATTEMPTS.delete(key)
    return false
  }

  return false
}

function recordLoginFailure(key: string): void {
  const now = Date.now()
  const current = LOGIN_ATTEMPTS.get(key)

  if (!current || now - current.firstAttemptAt > WINDOW_MS) {
    LOGIN_ATTEMPTS.set(key, { count: 1, firstAttemptAt: now })
    return
  }

  const nextCount = current.count + 1
  LOGIN_ATTEMPTS.set(key, {
    count: nextCount,
    firstAttemptAt: current.firstAttemptAt,
    blockedUntil: nextCount >= MAX_ATTEMPTS ? now + WINDOW_MS : undefined,
  })
}

function clearLoginFailures(key: string): void {
  LOGIN_ATTEMPTS.delete(key)
}

export type LoginFormState =
  | {
      errors?: {
        email?: string[]
        password?: string[]
      }
      message?: string
    }
  | undefined

export async function login(
  state: LoginFormState,
  formData: FormData
): Promise<LoginFormState> {
  const email = formData.get('email') as string
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

  const key = await getRateLimitKey(email)
  if (isRateLimited(key)) {
    logEvent('warn', 'auth.login.rate_limited', { email })
    return { message: 'Terlalu banyak percobaan login gagal. Silakan coba lagi dalam 10 menit.' }
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
    recordLoginFailure(key)
    if (user && user.is_blocked) {
      logEvent('warn', 'auth.login.blocked_user', { email, userId: user.id.toString() })
      return { message: 'Akun Anda telah diblokir. Hubungi administrator.' }
    }
    logEvent('warn', 'auth.login.failed', { email })
    return { message: 'Email atau password salah.' }
  }

  clearLoginFailures(key)
  await createSession(user.id.toString())
  logEvent('info', 'auth.login.succeeded', { email, userId: user.id.toString() })
  redirect('/dashboard')
}

export async function logout(): Promise<void> {
  await deleteSession()
  logEvent('info', 'auth.logout', {})
  redirect('/login')
}
