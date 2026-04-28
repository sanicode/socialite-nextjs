import { ApiError, requireApiEnabled } from '@/app/lib/api-auth'
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    await requireApiEnabled()
    return Response.json({ ok: true, sentry: false })
  } catch (error) {
    if (error instanceof ApiError) {
      return Response.json({ error: error.message }, { status: error.status })
    }
    return Response.json({ error: 'Request gagal' }, { status: 500 })
  }
}
