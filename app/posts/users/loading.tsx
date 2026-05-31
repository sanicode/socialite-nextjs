function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-neutral-200 dark:bg-neutral-700 ${className}`} />
}

export default function PostsUsersLoading() {
  return (
    <div className="min-h-screen bg-[var(--background)] px-4 py-5 sm:p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-72" />
        </div>

        <div className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between dark:border-neutral-800 dark:bg-neutral-900">
          <Skeleton className="h-10 w-48 rounded-lg" />
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
            <Skeleton className="h-10 w-full rounded-xl sm:w-80" />
            <Skeleton className="h-10 w-28 rounded-xl" />
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
          <div className="grid grid-cols-8 gap-4 border-b border-neutral-200 bg-neutral-50 px-4 py-3 dark:border-neutral-800 dark:bg-neutral-800/50">
            {Array.from({ length: 8 }).map((_, index) => (
              <Skeleton key={index} className="h-3.5 w-16" />
            ))}
          </div>
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="grid grid-cols-8 gap-4 border-b border-neutral-100 px-4 py-3 last:border-0 dark:border-neutral-800/60"
            >
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-10 w-12 rounded-lg" />
              <Skeleton className="h-10 w-12 rounded-lg" />
              <Skeleton className="h-10 w-12 rounded-lg" />
              <Skeleton className="h-8 w-16 rounded-lg" />
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-8 w-20 rounded-lg" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-8 w-20 rounded-lg" />
        </div>
      </div>
    </div>
  )
}
