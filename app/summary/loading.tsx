function Skeleton({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded bg-neutral-200 dark:bg-neutral-700 ${className ?? ''}`} />
  )
}

export default function SummaryLoading() {
  return (
    <div className="min-h-screen bg-[var(--background)] px-4 py-5 sm:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    </div>
  )
}

