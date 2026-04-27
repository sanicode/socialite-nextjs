'use client'

import { useActionState, useEffect, useState } from 'react'
import { login } from '@/app/actions/auth'
import { ToastProvider, useToast } from '@/app/components/ToastContext'
import ToastContainer from '@/app/components/ToastContainer'

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  if (m > 0) return `${m} menit ${s} detik`
  return `${s} detik`
}

function LoginFormBody({
  state,
  action,
  pending,
}: {
  state: Awaited<ReturnType<typeof login>>
  action: (formData: FormData) => void
  pending: boolean
}) {
  const { showToast } = useToast()
  const [countdown, setCountdown] = useState<number | null>(state?.retryAfter ?? null)

  useEffect(() => {
    if (countdown === null || countdown <= 0) return
    const timer = window.setInterval(() => {
      setCountdown((current) => {
        if (current === null) return null
        if (current <= 1) return 0
        return current - 1
      })
    }, 1000)

    return () => window.clearInterval(timer)
  }, [countdown])

  useEffect(() => {
    if (state?.message && !state.retryAfter) showToast('error', 'Login Gagal', state.message)
    if (state?.errors?.email) showToast('error', 'Email tidak valid', state.errors.email[0])
    if (state?.errors?.password) showToast('error', 'Password tidak valid', state.errors.password[0])
  }, [state, showToast])

  const isLocked = countdown !== null && countdown > 0

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)] px-4 py-8 sm:px-6 lg:px-8">
      <div className="w-full max-w-md px-8 py-10 bg-white dark:bg-neutral-900 rounded-2xl shadow-lg border border-neutral-200 dark:border-neutral-800">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-white tracking-tight">
            Login
          </h1>
          <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
            Silakan masukkan email dan password Anda
          </p>
        </div>

        {isLocked && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900/60 dark:bg-red-950/30">
            <div className="flex items-start gap-3">
              <svg className="mt-0.5 h-5 w-5 shrink-0 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              <div>
                <p className="text-sm font-semibold text-red-800 dark:text-red-200">
                  Akun sementara dikunci
                </p>
                <p className="mt-1 text-sm text-red-700 dark:text-red-300">
                  Terlalu banyak percobaan gagal. Coba lagi dalam{' '}
                  <span className="font-mono font-semibold">{formatCountdown(countdown!)}</span>.
                </p>
              </div>
            </div>
          </div>
        )}

        <form action={action} className="space-y-5">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5"
            >
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="nama@example.com"
              disabled={isLocked}
              className={`w-full px-3.5 py-2.5 rounded-lg border bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-500 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-white focus:border-transparent transition disabled:opacity-50 disabled:cursor-not-allowed ${
                state?.errors?.email ? 'border-red-400 dark:border-red-500' : 'border-neutral-300 dark:border-neutral-700'
              }`}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="password"
                className="block text-sm font-medium text-neutral-700 dark:text-neutral-300"
              >
                Password
              </label>
              <a href="#" className="text-xs text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition">
                Lupa password?
              </a>
            </div>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              disabled={isLocked}
              className={`w-full px-3.5 py-2.5 rounded-lg border bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-500 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-white focus:border-transparent transition disabled:opacity-50 disabled:cursor-not-allowed ${
                state?.errors?.password ? 'border-red-400 dark:border-red-500' : 'border-neutral-300 dark:border-neutral-700'
              }`}
            />
          </div>

          <button
            type="submit"
            disabled={pending || isLocked}
            className="w-full py-2.5 px-4 rounded-lg bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-sm font-semibold hover:bg-neutral-700 dark:hover:bg-neutral-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-neutral-900 dark:focus:ring-white transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {pending ? 'Memproses...' : isLocked ? `Terkunci (${formatCountdown(countdown!)})` : 'Masuk'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-neutral-500 dark:text-neutral-400">
          Belum punya akun?{' '}
          <a href="#" className="font-medium text-neutral-900 dark:text-white hover:underline">
            Hubungi admin
          </a>
        </p>
      </div>
    </div>
  )
}

function LoginForm() {
  const [state, action, pending] = useActionState(login, undefined)
  return <LoginFormBody key={state?.retryAfter ?? 'none'} state={state} action={action} pending={pending} />
}

export default function LoginPageClient() {
  return (
    <ToastProvider>
      <ToastContainer />
      <LoginForm />
    </ToastProvider>
  )
}
