import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getPostById, getCategories, updatePost } from '@/app/actions/posts'
import PostForm from '@/app/components/posts/PostForm'
import { getSecuritySettings } from '@/app/lib/request-security'
import { canUserEditPost } from '@/app/lib/post-edit-access'
import { getSessionUser } from '@/app/lib/session'

type Params = Promise<{ id: string }>

export default async function EditPostPage({ params }: { params: Params }) {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const { id } = await params
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

  return (
    <div className="min-h-screen bg-[var(--background)] px-4 py-5 sm:p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link
            href="/posts"
            className="text-sm text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition"
          >
            ← Kembali
          </Link>
          <span className="text-neutral-300 dark:text-neutral-700">/</span>
          <h1 className="text-xl font-bold text-neutral-900 dark:text-white">Edit Post</h1>
        </div>

        <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-4 sm:p-6">
          <PostForm
            action={updatePost}
            post={post}
            categories={categories}
            maxUploadFileSizeBytes={securitySettings.maxUploadedFileSizeBytes}
          />
        </div>
      </div>
    </div>
  )
}
