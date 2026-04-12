type Props = {
  searchParams: Promise<{
    message?: string
    ip?: string
    country?: string
  }>
}

export default async function BlockedPage({ searchParams }: Props) {
  const params = await searchParams

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)] px-4">
      <div className="w-full max-w-lg rounded-2xl border border-neutral-200 bg-white px-8 py-10 shadow-lg dark:border-neutral-800 dark:bg-neutral-900">
        <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">Akses Diblokir</h1>
        <p className="mt-3 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
          {params.message ?? 'Koneksi Anda tidak diizinkan mengakses aplikasi ini. Hubungi administrator jika Anda merasa ini adalah kesalahan.'}
        </p>

        <div className="mt-6 space-y-2 rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-sm dark:border-neutral-800 dark:bg-neutral-950/40">
          <p className="text-neutral-600 dark:text-neutral-400">
            IP: <span className="font-mono text-neutral-900 dark:text-white">{params.ip ?? 'Tidak terdeteksi'}</span>
          </p>
          <p className="text-neutral-600 dark:text-neutral-400">
            Negara: <span className="font-mono text-neutral-900 dark:text-white">{params.country ?? 'Tidak terdeteksi'}</span>
          </p>
        </div>
      </div>
    </div>
  )
}

