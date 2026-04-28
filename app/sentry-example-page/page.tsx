export default function Page() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md space-y-3 text-center">
        <h1 className="text-xl font-semibold text-neutral-900 dark:text-white">
          Sentry dinonaktifkan
        </h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Halaman contoh ini tidak lagi mengirim event ke Sentry.
        </p>
      </div>
    </main>
  )
}
