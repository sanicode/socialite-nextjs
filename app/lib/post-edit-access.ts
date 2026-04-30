import type { SessionUser } from '@/app/lib/session'
import { canActorEditPost } from '@/app/lib/tenant-access'

export type PostEditSubject = {
  userId: string | null
  tenantId: string | null
}

export async function canUserEditPost(
  user: Pick<SessionUser, 'id' | 'roles'>,
  subject: PostEditSubject | null | undefined,
): Promise<boolean> {
  return canActorEditPost(user, subject)
}
