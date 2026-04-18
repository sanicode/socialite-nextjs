function SkeletonBlock({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-2xl bg-neutral-200 dark:bg-neutral-800 ${className}`} />
}

export default function UploadLoading() {
  return (
    <div className="min-h-screen bg-[var(--background)] px-4 py-5 sm:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-2">
            <SkeletonBlock className="h-8 w-40" />
            <SkeletonBlock className="h-4 w-32" />
          </div>
          <SkeletonBlock className="h-11 w-36" />
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <SkeletonBlock className="h-11 flex-1 min-w-[180px]" />
          <SkeletonBlock className="h-11 sm:w-48" />
          <SkeletonBlock className="h-11 sm:w-40" />
          <SkeletonBlock className="h-11 sm:w-40" />
        </div>
        <div className="overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-800">
          <div className="space-y-3 p-4">
            <SkeletonBlock className="h-10 w-full rounded-xl" />
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonBlock key={i} className="h-16 w-full rounded-xl" />
            ))}
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
