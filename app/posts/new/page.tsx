import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCategories } from '@/app/actions/posts'
import { createPost } from '@/app/actions/posts'
import PostForm from '@/app/components/posts/PostForm'
import { getSessionUser } from '@/app/lib/session'

export default async function NewPostPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')
  const isAdmin = user.roles.includes('admin')
  const isManager = user.roles.includes('manager')
  if (isManager && !isAdmin) redirect('/posts')

  const categories = await getCategories()

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
          <h1 className="text-xl font-bold text-neutral-900 dark:text-white">
            Buat Post Baru
          </h1>
        </div>

        <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-4 sm:p-6">
          <PostForm action={createPost} categories={categories} />
        </div>
      </div>
    </div>
  )
}
