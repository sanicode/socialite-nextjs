'use server'


import { redirect } from 'next/navigation'
import bcrypt from 'bcryptjs'
import { prisma } from '@/app/lib/prisma'
import { createSession, deleteSession } from '@/app/lib/session'


// Rate limiter dinonaktifkan sementara
// const LOGIN_ATTEMPTS = new Map<string, { count: number; last: number }>()
// const MAX_ATTEMPTS = 5
// const WINDOW_MS = 10 * 60 * 1000 // 10 minutes

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


  // Rate limiter dinonaktifkan sementara
  // const key = email.toLowerCase()
  // const now = Date.now()
  // const attempt = LOGIN_ATTEMPTS.get(key)
  // if (attempt && attempt.count >= MAX_ATTEMPTS && now - attempt.last < WINDOW_MS) {
  //   return { message: 'Terlalu banyak percobaan login gagal. Silakan coba lagi nanti.' }
  // }

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
    // Rate limiter dinonaktifkan sementara
    // if (!attempt || now - attempt.last > WINDOW_MS) {
    //   LOGIN_ATTEMPTS.set(key, { count: 1, last: now })
    // } else {
    //   LOGIN_ATTEMPTS.set(key, { count: attempt.count + 1, last: now })
    // }
    if (user && user.is_blocked) {
      return { message: 'Akun Anda telah diblokir. Hubungi administrator.' }
    }
    return { message: 'Email atau password salah.' }
  }

  // LOGIN_ATTEMPTS.delete(key)

  await createSession(user.id.toString())
  redirect('/dashboard')
}

export async function logout(): Promise<void> {
  await deleteSession()
  redirect('/login')
}
