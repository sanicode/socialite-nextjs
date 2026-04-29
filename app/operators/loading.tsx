function Skeleton({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded bg-neutral-200 dark:bg-neutral-700 ${className ?? ''}`} />
  )
}

export default function OperatorsLoading() {
  return (
    <div className="min-h-screen bg-[var(--background)] px-4 py-5 sm:p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-4 w-64" />
        </div>

        {/* Filter */}
        <div className="grid grid-cols-1 gap-3 rounded-2xl border border-neutral-200 bg-white p-4 sm:grid-cols-2 dark:border-neutral-800 dark:bg-neutral-900">
          <Skeleton className="h-10 rounded-lg" />
          <Skeleton className="h-10 rounded-lg" />
          <div className="flex gap-3 sm:col-span-2">
            <Skeleton className="h-10 w-20 rounded-lg" />
            <Skeleton className="h-10 w-20 rounded-lg" />
          </div>
        </div>

        <div className="flex justify-end">
          <Skeleton className="h-10 w-full rounded-lg sm:max-w-xs" />
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
          <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-7 w-36 rounded-lg" />
          </div>
          <div className="grid grid-cols-4 gap-4 border-b border-neutral-100 bg-neutral-50 px-4 py-3 dark:border-neutral-800 dark:bg-neutral-800/50">
            {['w-16', 'w-16', 'w-20', 'w-10'].map((w, i) => (
              <Skeleton key={i} className={`h-3 ${w}`} />
            ))}
          </div>
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="grid grid-cols-4 gap-4 border-b border-neutral-100 px-4 py-3.5 last:border-0 dark:border-neutral-800/60"
            >
              <Skeleton className="h-3.5 w-28" />
              <Skeleton className="h-3.5 w-36" />
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="ml-auto h-7 w-14 rounded-lg" />
            </div>
          ))}
        </div>

        {/* Pagination */}
        <Skeleton className="h-4 w-36" />
      </div>
    </div>
  )
}
