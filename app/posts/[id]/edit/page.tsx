import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { getPostById, getCategories, updatePost, updateUpload, updateAmplifikasi } from '@/app/actions/posts'
import PostForm from '@/app/components/posts/PostForm'
import { getSecuritySettings } from '@/app/lib/request-security'
import { canUserEditPost } from '@/app/lib/post-edit-access'
import { getSessionUser } from '@/app/lib/session'
import { normalizeReturnTo, refererToReturnTo } from '@/app/lib/return-to'
import { getNonAdminReportingWindowDecision } from '@/app/lib/operator-reporting-window'

type Params = Promise<{ id: string }>
type SearchParams = Promise<{ returnTo?: string }>

export default async function EditPostPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const { id } = await params
  const { returnTo } = await searchParams
  const headerStore = await headers()
  const refererReturnTo = refererToReturnTo(headerStore.get('referer'))
  const [post, categories, securitySettings] = await Promise.all([
    getPostById(id),
    getCategories(),
    getSecuritySettings(),
  ])

  if (!post) notFound()
  if (!user.roles.includes('admin')) {
    const canEdit = await canUserEditPost(user, {
      userId: post.user?.id ?? null,
      tenantId: post.tenant_id ?? null,
    })
    if (!canEdit) redirect('/posts')
  }

  const editConfig =
    post.source_url === 'upload'
      ? {
          action: updateUpload,
          variant: 'upload' as const,
          basePath: '/posts/upload',
          title: 'Edit Upload',
          backHref: '/posts/upload',
        }
      : post.source_url === 'amplifikasi'
        ? {
            action: updateAmplifikasi,
            variant: 'amplifikasi' as const,
            basePath: '/posts/amplifikasi',
            title: 'Edit Amplifikasi',
            backHref: '/posts/amplifikasi',
          }
        : {
            action: updatePost,
            variant: 'default' as const,
            basePath: '/posts',
            title: 'Edit Post',
            backHref: '/posts',
          }

  const reportingWindowDecision = await getNonAdminReportingWindowDecision(user.roles)
  if (!reportingWindowDecision.allowed) redirect(editConfig.backHref)

  const backHref = normalizeReturnTo(returnTo ?? refererReturnTo, editConfig.backHref)

  return (
    <div className="min-h-screen bg-[var(--background)] px-4 py-5 sm:p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link
            href={backHref}
            className="text-sm text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition"
          >
            ← Kembali
          </Link>
          <span className="text-neutral-300 dark:text-neutral-700">/</span>
          <h1 className="text-xl font-bold text-neutral-900 dark:text-white">{editConfig.title}</h1>
        </div>

        <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-4 sm:p-6">
          <PostForm
            action={editConfig.action}
            post={post}
            categories={categories}
            maxUploadFileSizeBytes={securitySettings.maxUploadedFileSizeBytes}
            imageCompressionEnabled={securitySettings.imageCompressionEnabled}
            variant={editConfig.variant}
            basePath={editConfig.basePath}
            returnTo={backHref}
          />
        </div>
      </div>
    </div>
  )
}
