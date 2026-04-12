function Skeleton({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded bg-neutral-200 dark:bg-neutral-700 ${className ?? ''}`} />
  )
}

export default function SecurityLoading() {
  return (
    <div className="min-h-screen bg-[var(--background)] px-4 py-5 sm:p-6">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="space-y-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-4 w-80" />
        </div>

        {/* Form card */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-4 sm:p-6 dark:border-neutral-800 dark:bg-neutral-900 space-y-6">

          {/* Info boxes */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-950/40 space-y-2.5">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-36" />
            </div>
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-950/40 space-y-2.5">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </div>

          <div className="space-y-5">
            {/* Blokir IP textarea */}
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-48 w-full rounded-xl" />
              <Skeleton className="h-3.5 w-64" />
            </div>

            {/* Negara textarea */}
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-24 w-full rounded-xl" />
              <Skeleton className="h-3.5 w-56" />
            </div>

            {/* Checkbox row */}
            <div className="rounded-xl border border-neutral-200 bg-white px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900">
              <div className="flex items-start gap-3">
                <Skeleton className="mt-1 h-4 w-4 shrink-0 rounded" />
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-52" />
                  <Skeleton className="h-3.5 w-80" />
                </div>
              </div>
            </div>
          </div>

          {/* Save button */}
          <div className="flex items-center justify-end">
            <Skeleton className="h-10 w-36 rounded-lg" />
          </div>

        </div>
      </div>
    </div>
  )
}
