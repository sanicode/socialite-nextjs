type Props = {
  title: string
  description?: string
}

function SkeletonBlock({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-2xl bg-neutral-200 dark:bg-neutral-800 ${className}`} />
}

export default function RequestLoadingOverlay({ title, description }: Props) {
  return (
    <div className="fixed inset-x-0 top-16 bottom-0 z-40 bg-white/75 backdrop-blur-sm dark:bg-neutral-950/70 md:left-60">
      <div className="h-full overflow-auto px-4 py-5 sm:p-6">
        <div className="mx-auto max-w-6xl space-y-6">
          <div className="space-y-2">
            <p className="text-sm font-semibold text-neutral-900 dark:text-white">{title}</p>
            {description && (
              <p className="text-xs text-neutral-500 dark:text-neutral-400">{description}</p>
            )}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <SkeletonBlock className="h-11 flex-1 min-w-[180px]" />
            <SkeletonBlock className="h-11 sm:w-44" />
            <SkeletonBlock className="h-11 sm:w-44" />
            <SkeletonBlock className="h-11 sm:w-48" />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <SkeletonBlock className="h-28" />
            <SkeletonBlock className="h-28" />
            <SkeletonBlock className="h-28" />
          </div>

          <SkeletonBlock className="h-72" />
          <SkeletonBlock className="h-72" />
        </div>
      </div>
    </div>
  )
}

