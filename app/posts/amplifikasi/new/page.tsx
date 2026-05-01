import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCategories, createAmplifikasi } from '@/app/actions/posts'
import PostForm from '@/app/components/posts/PostForm'
import { getSecuritySettings } from '@/app/lib/request-security'
import { getSessionUser } from '@/app/lib/session'
import { getOperatorReportingWindowDecision } from '@/app/lib/operator-reporting-window'

export default async function NewAmplifikasiPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')
  const isAdmin = user.roles.includes('admin')
  const isManager = user.roles.includes('manager')
  if (isManager && !isAdmin) redirect('/posts/amplifikasi')
  const reportingWindowDecision = await getOperatorReportingWindowDecision(user.roles)
  if (!reportingWindowDecision.allowed) redirect('/posts/amplifikasi?reportingWindow=closed')

  const [categories, securitySettings] = await Promise.all([
    getCategories(),
    getSecuritySettings(),
  ])

  return (
    <div className="min-h-screen bg-[var(--background)] px-4 py-5 sm:p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Link
            href="/posts/amplifikasi"
            className="text-sm text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition"
          >
            ← Kembali
          </Link>
          <span className="text-neutral-300 dark:text-neutral-700">/</span>
          <h1 className="text-xl font-bold text-neutral-900 dark:text-white">Buat Laporan Amplifikasi</h1>
        </div>

        <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-4 sm:p-6">
          <PostForm
            action={createAmplifikasi}
            categories={categories}
            maxUploadFileSizeBytes={securitySettings.maxUploadedFileSizeBytes}
            imageCompressionEnabled={securitySettings.imageCompressionEnabled}
            variant="amplifikasi"
            basePath="/posts/amplifikasi"
          />
        </div>
      </div>
    </div>
  )
}
