function SkeletonBlock({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-2xl bg-neutral-200 dark:bg-neutral-800 ${className}`} />
}

export default function PostsLoading() {
  return (
    <div className="min-h-screen bg-[var(--background)] px-4 py-5 sm:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-2">
            <SkeletonBlock className="h-8 w-40" />
            <SkeletonBlock className="h-4 w-32" />
          </div>
          <SkeletonBlock className="h-10 w-36" />
        </div>

        <div className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between dark:border-neutral-800 dark:bg-neutral-900">
          <SkeletonBlock className="h-10 w-44 rounded-lg" />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <SkeletonBlock className="h-10 w-full rounded-xl sm:w-80" />
            <SkeletonBlock className="h-10 w-28 rounded-xl" />
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-800">
          <div className="space-y-3 p-4">
            <SkeletonBlock className="h-10 w-full rounded-xl" />
            <SkeletonBlock className="h-16 w-full rounded-xl" />
            <SkeletonBlock className="h-16 w-full rounded-xl" />
            <SkeletonBlock className="h-16 w-full rounded-xl" />
            <SkeletonBlock className="h-16 w-full rounded-xl" />
            <SkeletonBlock className="h-16 w-full rounded-xl" />
          </div>
        </div>

        <div className="flex flex-col items-start gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <SkeletonBlock className="h-4 w-40 rounded-md" />
          <div className="flex items-center gap-2">
            <SkeletonBlock className="h-8 w-20 rounded-lg" />
            <SkeletonBlock className="h-4 w-16 rounded-md" />
            <SkeletonBlock className="h-8 w-20 rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  )
}
