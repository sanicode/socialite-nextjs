function Skeleton({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded bg-neutral-200 dark:bg-neutral-700 ${className ?? ''}`} />
  )
}

export default function TenantsLoading() {
  return (
    <div className="min-h-screen bg-background px-4 py-5 sm:p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-4 w-80" />
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

        {/* Table */}
        <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
          {/* Header */}
          <div className="grid grid-cols-5 gap-4 border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
            {['w-32', 'w-28', 'w-20', 'w-20', 'w-20'].map((w, i) => (
              <Skeleton key={i} className={`h-3.5 ${w}`} />
            ))}
          </div>
          {/* Rows */}
          {Array.from({ length: 7 }).map((_, i) => (
            <div
              key={i}
              className="grid grid-cols-5 gap-4 border-b border-neutral-100 px-4 py-3.5 last:border-0 dark:border-neutral-800/60"
            >
              <Skeleton className="h-3.5 w-36" />
              <Skeleton className="h-3.5 w-28" />
              <Skeleton className="h-5 w-14 rounded-full" />
              <Skeleton className="h-5 w-14 rounded-full" />
              <div className="flex gap-2">
                <Skeleton className="h-7 w-14 rounded-lg" />
                <Skeleton className="h-7 w-14 rounded-lg" />
              </div>
            </div>
          ))}
        </div>

        {/* Pagination */}
        <Skeleton className="h-4 w-44" />
      </div>
    </div>
  )
}
