import { getSessionUser } from '@/app/lib/session'
import { redirect } from 'next/navigation'
import { prisma } from '@/app/lib/prisma'
import Link from 'next/link'

import UserPostsTableClient from './UserPostsTableClient';

export default async function UserPostsByStatusPage({ params }: { params: Promise<any> }) {
  const user = await getSessionUser()
  if (!user) redirect('/login')
  if (!user.roles.some(role => ['admin', 'manager'].includes(role))) redirect('/posts/upload')

  const { userId, status } = await params
  
  if (!userId || isNaN(Number(userId))) {
    return <div className="min-h-screen bg-[var(--background)] px-4 py-5 sm:p-6 text-neutral-500">User ID tidak valid</div>
  }

  const userData = await prisma.users.findUnique({
    where: { id: BigInt(userId) },
  })

  if (!userData) {
    return <div className="min-h-screen bg-[var(--background)] px-4 py-5 sm:p-6 text-neutral-500">User tidak ditemukan</div>
  }

  const posts = await prisma.blog_posts.findMany({
    where: {
      user_id: userData.id,
      status,
    },
    orderBy: { created_at: 'desc' },
    include: {
      blog_post_categories: true,
    },
  })

  const postIds = posts.map((p) => p.id)
  let mediaByPostId: Record<string, any> = {}

  if (postIds.length > 0) {
    const media = await prisma.media.findMany({
      where: {
        model_type: 'App\\Models\\BlogPost',
        collection_name: 'blog-images',
        model_id: { in: postIds },
      },
      orderBy: { order_column: 'asc' },
    })

    // Grouping media secara efisien
    mediaByPostId = media.reduce((acc, m) => {
      const id = m.model_id.toString()
      if (!acc[id]) acc[id] = m
      return acc
    }, {} as Record<string, any>)
  }

  // Helper untuk menangani serialisasi BigInt
  const serialize = (data: any) => JSON.parse(JSON.stringify(data, (_, v) => 
    typeof v === 'bigint' ? v.toString() : v
  ))

  return (
    <div className="min-h-screen bg-[var(--background)] px-4 py-5 sm:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Link
            href="/posts/users"
            className="text-sm text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition"
          >
            ← Kembali
          </Link>
          <span className="text-neutral-300 dark:text-neutral-700">/</span>
          <h1 className="text-xl font-bold text-neutral-900 dark:text-white capitalize">
            Laporan {status} — {userData.name}
          </h1>
        </div>
        <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
          <UserPostsTableClient
            posts={serialize(posts)}
            mediaByPostId={serialize(mediaByPostId)}
            userData={serialize(userData)}
            status={status}
          />
        </div>
      </div>
    </div>
  )
}