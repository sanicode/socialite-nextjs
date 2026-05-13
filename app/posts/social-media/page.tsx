import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCategories } from '@/app/actions/posts'
import { getConnectedSocialMedias } from '@/app/actions/social-medias'
import SocialMediaPostForm from '@/app/components/posts/SocialMediaPostForm'
import { getOperatorReportingWindowDecision } from '@/app/lib/operator-reporting-window'
import { getSecuritySettings } from '@/app/lib/request-security'
import { getSessionUser } from '@/app/lib/session'

export default async function SocialMediaPostPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const isAdmin = user.roles.includes('admin')
  const isManager = user.roles.includes('manager')
  const isOperator = user.roles.includes('operator') && !isAdmin && !isManager
  if (!isOperator) redirect('/posts')

  const securitySettings = await getSecuritySettings()
  if (!securitySettings.socialMediaConnectionsEnabled) redirect('/posts/upload')

  const [categories, socialMedias, reportingWindowDecision] = await Promise.all([
    getCategories(),
    getConnectedSocialMedias(),
    getOperatorReportingWindowDecision(user.roles),
  ])

  return (
    <div className="min-h-screen bg-[var(--background)] px-4 py-5 sm:p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-center gap-3">
          <Link
            href="/posts/upload"
            className="text-sm text-neutral-500 transition hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
          >
            ← Kembali
          </Link>
          <span className="text-neutral-300 dark:text-neutral-700">/</span>
          <h1 className="text-xl font-bold text-neutral-900 dark:text-white">Posting Media Sosial</h1>
        </div>

        <div>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Buat postingan dengan upload foto atau video berdasarkan kategori media sosial yang dipilih. Saat ini posting otomatis baru tersedia untuk Facebook Page.
          </p>
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white p-4 sm:p-6 dark:border-neutral-800 dark:bg-neutral-900">
          <SocialMediaPostForm
            categories={categories}
            accounts={socialMedias.accounts}
            disabledMessage={reportingWindowDecision.allowed ? null : reportingWindowDecision.message}
          />
        </div>
      </div>
    </div>
  )
}
