'use client'

import { getSafeApplicationError } from '@/app/lib/database-errors'

type Props = {
  error: Error & { digest?: string }
  reset?: () => void
}

export default function AppErrorScreen({ error, reset }: Props) {
  const safeError = getSafeApplicationError(error)

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 py-10 text-neutral-900 dark:bg-neutral-950 dark:text-white">
      <section className="w-full max-w-lg rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-300">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v4m0 4h.01M4.93 19h14.14a2 2 0 001.73-3L13.73 4a2 2 0 00-3.46 0L3.2 16a2 2 0 001.73 3z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-red-600 dark:text-red-300">
              {safeError.code}
            </p>
            <h1 className="mt-1 text-2xl font-bold">{safeError.title}</h1>
            <p className="mt-3 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
              {safeError.message}
            </p>
            {error.digest && (
              <p className="mt-3 font-mono text-xs text-neutral-400 dark:text-neutral-500">
                Error ID: {error.digest}
              </p>
            )}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {reset && (
            <button
              type="button"
              onClick={reset}
              className="rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100"
            >
              Coba lagi
            </button>
          )}
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-lg border border-neutral-300 px-4 py-2.5 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
          >
            Muat ulang
          </button>
        </div>
      </section>
    </main>
  )
}
