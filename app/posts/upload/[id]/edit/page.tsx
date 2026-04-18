import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getPostById, getCategories, updateUpload } from '@/app/actions/posts'
import PostForm from '@/app/components/posts/PostForm'
import { getSecuritySettings } from '@/app/lib/request-security'
import { getSessionUser } from '@/app/lib/session'

type Params = Promise<{ id: string }>

export default async function EditUploadPage({ params }: { params: Params }) {
  const user = await getSessionUser()
  if (!user) redirect('/login')
  const isAdmin = user.roles.includes('admin')
  const isManager = user.roles.includes('manager')
  if (isManager && !isAdmin) redirect('/posts/upload')

  const { id } = await params
  const [post, categories, securitySettings] = await Promise.all([
    getPostById(id),
    getCategories(),
    getSecuritySettings(),
  ])

  if (!post) notFound()

  return (
    <div className="min-h-screen bg-[var(--background)] px-4 py-5 sm:p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Link
            href="/posts/upload"
            className="text-sm text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition"
          >
            ← Kembali
          </Link>
          <span className="text-neutral-300 dark:text-neutral-700">/</span>
          <h1 className="text-xl font-bold text-neutral-900 dark:text-white">Edit Upload</h1>
        </div>

        <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-4 sm:p-6">
          <PostForm
            action={updateUpload}
            post={post}
            categories={categories}
            maxUploadFileSizeBytes={securitySettings.maxUploadedFileSizeBytes}
            variant="upload"
            basePath="/posts/upload"
          />
        </div>
      </div>
    </div>
  )
}
