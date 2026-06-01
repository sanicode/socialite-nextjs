function Skeleton({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded bg-neutral-200 dark:bg-neutral-700 ${className ?? ''}`} />
  )
}

export default function LogsLoading() {
  return (
    <div className="min-h-screen bg-[var(--background)] px-4 py-5 sm:p-6">
      <div className="mx-auto max-w-7xl space-y-6">

        {/* Header */}
        <div className="space-y-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-4 w-72" />
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3">
          <Skeleton className="h-10 w-32 rounded-lg" />
          <div className="h-5 w-px bg-neutral-200 dark:bg-neutral-700" />
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-6 w-11 rounded-full" />
        </div>

        {/* Filter toolbar */}
        <div className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between dark:border-neutral-800 dark:bg-neutral-900">
          <Skeleton className="h-10 w-40 rounded-lg" />
          <div className="flex w-full gap-2 sm:w-auto">
            <Skeleton className="h-10 flex-1 rounded-xl sm:w-64" />
            <Skeleton className="h-10 w-20 rounded-xl" />
            <Skeleton className="h-10 w-24 rounded-xl" />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
          {/* Table header */}
          <div className="grid grid-cols-7 gap-4 border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="h-3.5 w-20" />
            ))}
          </div>
          {/* Table rows */}
          {Array.from({ length: 10 }).map((_, row) => (
            <div
              key={row}
              className="grid grid-cols-7 gap-4 border-b border-neutral-100 px-4 py-3.5 last:border-0 dark:border-neutral-800/60"
            >
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-3.5 w-28" />
              <Skeleton className="h-3.5 w-20" />
              <Skeleton className="h-3.5 w-16" />
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-3.5 w-28" />
              <Skeleton className="h-3.5 w-32" />
            </div>
          ))}
        </div>

        {/* Pagination */}
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-40" />
        </div>

      </div>
    </div>
  )
}
