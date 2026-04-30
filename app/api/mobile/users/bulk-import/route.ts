import bcrypt from 'bcryptjs'
import { requireJwtRole, apiError, ApiError, requireApiEnabled } from '@/app/lib/api-auth'
import { prisma } from '@/app/lib/prisma'
import { logEvent } from '@/app/lib/logger'
import { buildBulkUserImportPreview } from './preview/route'

export async function POST(request: Request) {
  try {
    await requireApiEnabled()
    const admin = await requireJwtRole(request, 'admin')
    const body = await request.json()
    if (!body.text || typeof body.text !== 'string') {
      throw new ApiError(400, 'Field "text" wajib diisi.')
    }

    const preview = await buildBulkUserImportPreview(body.text)
    const rowsToCreate = preview.rows.filter((r) => r.status === 'valid')

    if (rowsToCreate.length === 0) {
      return Response.json({ ...preview, createdRows: 0, skippedRows: preview.totalRows })
    }

    const data = await Promise.all(
      rowsToCreate.map(async (row) => ({
        name: row.name,
        email: row.email,
        password: await bcrypt.hash(row.phone_number, 12),
        phone_number: row.phone_number,
        is_admin: false,
        is_blocked: false,
      }))
    )

    const result = await prisma.users.createMany({ data, skipDuplicates: true })

    logEvent('info', 'user.bulk_imported', {
      adminId: admin.sub,
      source: 'text',
      created: result.count,
      skipped: preview.totalRows - result.count,
    })

    return Response.json({
      ...preview,
      createdRows: result.count,
      skippedRows: preview.totalRows - result.count,
    })
  } catch (error) {
    return apiError(error)
  }
}
