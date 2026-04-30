import { ApiError, requireApiEnabled } from '@/app/lib/api-auth'
import { getSessionUser } from '@/app/lib/session'
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    await requireApiEnabled()
    const user = await getSessionUser()
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
    if (!user.roles.includes('admin')) return Response.json({ error: 'Forbidden' }, { status: 403 })
    return Response.json({ ok: true, sentry: false })
  } catch (error) {
    if (error instanceof ApiError) {
      return Response.json({ error: error.message }, { status: error.status })
    }
    return Response.json({ error: 'Request gagal' }, { status: 500 })
  }
}
