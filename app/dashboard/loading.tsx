function SkeletonBlock({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-2xl bg-neutral-200 dark:bg-neutral-800 ${className}`} />
}

export default function DashboardLoading() {
  return (
    <div className="px-4 py-5 sm:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="space-y-2">
          <SkeletonBlock className="h-8 w-48" />
          <SkeletonBlock className="h-4 w-80 max-w-full" />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <SkeletonBlock className="h-11 w-full sm:w-44" />
          <SkeletonBlock className="h-11 w-full sm:w-44" />
          <SkeletonBlock className="h-11 w-full sm:w-52" />
          <SkeletonBlock className="h-11 w-full sm:w-52" />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <SkeletonBlock className="h-28" />
          <SkeletonBlock className="h-28" />
          <SkeletonBlock className="h-28" />
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <SkeletonBlock className="h-80" />
          <SkeletonBlock className="h-80" />
        </div>

        <SkeletonBlock className="h-80" />
        <SkeletonBlock className="h-96" />
      </div>
    </div>
  )
}

