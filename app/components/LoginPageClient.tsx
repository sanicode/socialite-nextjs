'use client'

import Script from 'next/script'
import { useActionState, useCallback, useEffect, useRef, useState } from 'react'
import { login } from '@/app/actions/auth'
import { ToastProvider, useToast } from '@/app/components/ToastContext'
import ToastContainer from '@/app/components/ToastContainer'

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string
          callback: (token: string) => void
          'expired-callback': () => void
          'error-callback': () => void
          theme?: 'light' | 'dark' | 'auto'
          size?: 'normal' | 'flexible' | 'compact'
        }
      ) => string
      reset: (widgetId?: string) => void
      remove: (widgetId: string) => void
    }
  }
}

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  if (m > 0) return `${m} menit ${s} detik`
  return `${s} detik`
}

function PasswordVisibilityIcon({ visible }: { visible: boolean }) {
  if (visible) {
    return (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.75}
          d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"
        />
      </svg>
    )
  }

  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .638C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </svg>
  )
}

function CaptchaField({ siteKey, resetSignal }: { siteKey: string; resetSignal: unknown }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<string | null>(null)
  const [token, setToken] = useState('')
  const [ready, setReady] = useState(false)

  const renderCaptcha = useCallback(() => {
    if (!containerRef.current || !window.turnstile || widgetIdRef.current) return
    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      theme: 'auto',
      size: 'flexible',
      callback: setToken,
      'expired-callback': () => setToken(''),
      'error-callback': () => setToken(''),
    })
    setReady(true)
  }, [siteKey])

  useEffect(() => {
    const timer = window.setTimeout(renderCaptcha, 0)

    return () => {
      window.clearTimeout(timer)
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current)
        widgetIdRef.current = null
      }
    }
  }, [renderCaptcha])

  useEffect(() => {
    const timer = window.setTimeout(() => setToken(''), 0)
    if (widgetIdRef.current && window.turnstile) {
      window.turnstile.reset(widgetIdRef.current)
    }
    return () => window.clearTimeout(timer)
  }, [resetSignal])

  return (
    <div className="space-y-2">
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onReady={renderCaptcha}
      />
      <input type="hidden" name="cf-turnstile-response" value={token} />
      <div className="flex min-h-[65px] w-full items-center justify-center">
        <div ref={containerRef} className="w-full [&>iframe]:!w-full" />
      </div>
      {!ready && (
        <p className="text-center text-xs text-neutral-500 dark:text-neutral-400">Memuat verifikasi keamanan...</p>
      )}
    </div>
  )
}

function LoginFormBody({
  state,
  action,
  pending,
  captchaSiteKey,
  initialCaptchaRequired,
}: {
  state: Awaited<ReturnType<typeof login>>
  action: (formData: FormData) => void
  pending: boolean
  captchaSiteKey: string | null
  initialCaptchaRequired: boolean
}) {
  const { showToast } = useToast()
  const [countdown, setCountdown] = useState<number | null>(state?.retryAfter ?? null)
  const [passwordVisible, setPasswordVisible] = useState(false)

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
    if (state?.errors?.captcha) showToast('error', 'Verifikasi gagal', state.errors.captcha[0])
  }, [state, showToast])

  const isLocked = countdown !== null && countdown > 0
  const shouldShowCaptcha = Boolean(captchaSiteKey && (initialCaptchaRequired || state?.requireCaptcha))

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
            <div className="relative">
              <input
                id="password"
                name="password"
                type={passwordVisible ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="••••••••"
                disabled={isLocked}
                className={`w-full rounded-lg border bg-white px-3.5 py-2.5 pr-11 text-sm text-neutral-900 placeholder-neutral-400 transition focus:border-transparent focus:outline-none focus:ring-2 focus:ring-neutral-900 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-neutral-800 dark:text-white dark:placeholder-neutral-500 dark:focus:ring-white ${
                  state?.errors?.password ? 'border-red-400 dark:border-red-500' : 'border-neutral-300 dark:border-neutral-700'
                }`}
              />
              <button
                type="button"
                onClick={() => setPasswordVisible((visible) => !visible)}
                disabled={isLocked}
                aria-label={passwordVisible ? 'Sembunyikan password' : 'Tampilkan password'}
                aria-pressed={passwordVisible}
                className="absolute inset-y-0 right-0 inline-flex w-11 items-center justify-center rounded-r-lg text-neutral-500 transition hover:text-neutral-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-neutral-900 disabled:cursor-not-allowed disabled:opacity-50 dark:text-neutral-400 dark:hover:text-white dark:focus-visible:ring-white"
              >
                <PasswordVisibilityIcon visible={passwordVisible} />
              </button>
            </div>
          </div>

          {shouldShowCaptcha && captchaSiteKey && (
            <CaptchaField
              siteKey={captchaSiteKey}
              resetSignal={state}
            />
          )}

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

function LoginForm({
  captchaSiteKey,
  initialCaptchaRequired,
}: {
  captchaSiteKey: string | null
  initialCaptchaRequired: boolean
}) {
  const [state, action, pending] = useActionState(login, undefined)
  return (
    <LoginFormBody
      key={state?.retryAfter ?? 'none'}
      state={state}
      action={action}
      pending={pending}
      captchaSiteKey={captchaSiteKey}
      initialCaptchaRequired={initialCaptchaRequired}
    />
  )
}

export default function LoginPageClient({
  captchaSiteKey,
  initialCaptchaRequired,
}: {
  captchaSiteKey: string | null
  initialCaptchaRequired: boolean
}) {
  return (
    <ToastProvider>
      <ToastContainer />
      <LoginForm captchaSiteKey={captchaSiteKey} initialCaptchaRequired={initialCaptchaRequired} />
    </ToastProvider>
  )
}
