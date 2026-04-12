'use client'

import { useActionState, useEffect } from 'react'
import { login } from '@/app/actions/auth'
import { ToastProvider, useToast } from '@/app/components/ToastContext'
import ToastContainer from '@/app/components/ToastContainer'

function LoginForm() {
  const [state, action, pending] = useActionState(login, undefined)
  const { showToast } = useToast()

  useEffect(() => {
    if (state?.message) showToast('error', 'Login Gagal', state.message)
    if (state?.errors?.email) showToast('error', 'Email tidak valid', state.errors.email[0])
    if (state?.errors?.password) showToast('error', 'Password tidak valid', state.errors.password[0])
  }, [state]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
      <div className="w-full max-w-md px-8 py-10 bg-white dark:bg-neutral-900 rounded-2xl shadow-lg border border-neutral-200 dark:border-neutral-800">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-white tracking-tight">
            Login
          </h1>
          <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
            Silakan masukkan email dan password Anda
          </p>
        </div>

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
              className={`w-full px-3.5 py-2.5 rounded-lg border bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-500 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-white focus:border-transparent transition ${
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
              className={`w-full px-3.5 py-2.5 rounded-lg border bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-500 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-white focus:border-transparent transition ${
                state?.errors?.password ? 'border-red-400 dark:border-red-500' : 'border-neutral-300 dark:border-neutral-700'
              }`}
            />
          </div>

          <button
            type="submit"
            disabled={pending}
            className="w-full py-2.5 px-4 rounded-lg bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-sm font-semibold hover:bg-neutral-700 dark:hover:bg-neutral-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-neutral-900 dark:focus:ring-white transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {pending ? 'Memproses...' : 'Masuk'}
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

export default function LoginPage() {
  return (
    <ToastProvider>
      <ToastContainer />
      <LoginForm />
    </ToastProvider>
  )
}
