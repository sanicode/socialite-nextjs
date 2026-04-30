import { requireJwtRole, apiError, ApiError, requireApiEnabled } from '@/app/lib/api-auth'
import { setConfigValue } from '@/app/lib/configs'
import { logEvent } from '@/app/lib/logger'

export async function PATCH(request: Request) {
  try {
    await requireApiEnabled()
    const admin = await requireJwtRole(request, 'admin')
    const body = await request.json()

    if (typeof body.enabled !== 'boolean') {
      throw new ApiError(400, 'Field "enabled" harus berupa boolean.')
    }

    await setConfigValue('access_logs_enabled', body.enabled ? '1' : '0')
    logEvent('warn', 'access_logs.toggle', { userId: admin.sub, enabled: body.enabled })
    return Response.json({ enabled: body.enabled })
  } catch (error) {
    return apiError(error)
  }
}
