function Skeleton({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded bg-neutral-200 dark:bg-neutral-700 ${className ?? ''}`} />
  )
}

export default function SocialMediaCategoriesLoading() {
  return (
    <div className="min-h-screen bg-background px-4 py-5 sm:p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>

        <div className="flex justify-end">
          <Skeleton className="h-8 w-36 rounded-lg" />
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Skeleton className="h-10 w-44 rounded-lg" />
            <div className="flex gap-2">
              <Skeleton className="h-7 w-20 rounded-full" />
              <Skeleton className="h-7 w-24 rounded-full" />
              <Skeleton className="h-7 w-20 rounded-full" />
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Skeleton className="h-10 w-72 rounded-lg" />
            <div className="flex gap-2">
              <Skeleton className="h-10 w-20 rounded-lg" />
              <Skeleton className="h-10 w-20 rounded-lg" />
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
          <div className="grid grid-cols-8 gap-4 border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
            {['w-28', 'w-24', 'w-24', 'w-16', 'w-16', 'w-28', 'w-28', 'w-20'].map((width, index) => (
              <Skeleton key={index} className={`h-3.5 ${width}`} />
            ))}
          </div>
          {Array.from({ length: 7 }).map((_, index) => (
            <div
              key={index}
              className="grid grid-cols-8 gap-4 border-b border-neutral-100 px-4 py-3.5 last:border-0 dark:border-neutral-800/60"
            >
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-8 w-36 rounded-lg" />
            </div>
          ))}
        </div>

        <Skeleton className="h-4 w-44" />
      </div>
    </div>
  )
}
