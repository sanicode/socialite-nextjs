import { requireJwtRole, apiError, ApiError, requireApiEnabled } from '@/app/lib/api-auth'
import { prisma } from '@/app/lib/prisma'
import { logEvent } from '@/app/lib/logger'
import { buildTenantOperatorImportPreview } from './preview/route'

const MODEL_TYPE_TENANT_USER = 'App\\Models\\TenantUser'

type Ctx = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: Ctx) {
  try {
    await requireApiEnabled()
    const admin = requireJwtRole(request, 'admin')
    const { id: tenantId } = await params
    const body = await request.json()
    if (!body.text || typeof body.text !== 'string') throw new ApiError(400, 'Field "text" wajib diisi.')

    const preview = await buildTenantOperatorImportPreview(tenantId, body.text)
    const rowsToImport = preview.rows.filter(
      (row): row is typeof row & { user_id: string; name: string } =>
        row.status === 'valid' && row.user_id !== null && row.name !== null
    )

    if (rowsToImport.length === 0) {
      return Response.json({ ...preview, createdRows: 0, skippedRows: preview.totalRows })
    }

    const role = await prisma.roles.findFirst({
      where: { name: 'operator' },
      orderBy: [{ is_tenant_role: 'desc' }, { id: 'asc' }],
    })
    if (!role) throw new ApiError(500, "Role 'operator' tidak ditemukan di database.")

    const newUserIds = rowsToImport.filter((r) => r.tenant_user_id === null).map((r) => BigInt(r.user_id))
    const existingTenantUserIds = rowsToImport.filter((r) => r.tenant_user_id !== null).map((r) => BigInt(r.tenant_user_id as string))

    const insertResult = await prisma.$queryRaw<{ count: bigint }[]>`
      WITH existing_tenant_user(id) AS (
        SELECT DISTINCT UNNEST(${existingTenantUserIds}::bigint[])
      ),
      eligible_existing AS (
        SELECT tu.id FROM existing_tenant_user e
        INNER JOIN tenant_user tu ON tu.id = e.id
        INNER JOIN users u ON u.id = tu.user_id
        WHERE tu.tenant_id = ${BigInt(tenantId)}
          AND u.is_blocked = false
          AND NOT EXISTS (
            SELECT 1 FROM model_has_roles mhr
            WHERE mhr.model_type = ${MODEL_TYPE_TENANT_USER} AND mhr.model_id = tu.id
          )
      ),
      candidate(user_id) AS (
        SELECT DISTINCT UNNEST(${newUserIds}::bigint[])
      ),
      eligible AS (
        SELECT c.user_id FROM candidate c
        INNER JOIN users u ON u.id = c.user_id
        WHERE u.is_blocked = false
          AND NOT EXISTS (SELECT 1 FROM tenant_user tu WHERE tu.tenant_id = ${BigInt(tenantId)} AND tu.user_id = c.user_id)
          AND NOT EXISTS (
            SELECT 1 FROM tenant_user tu
            INNER JOIN model_has_roles mhr ON mhr.model_type = ${MODEL_TYPE_TENANT_USER} AND mhr.model_id = tu.id
            WHERE tu.user_id = c.user_id
          )
      ),
      inserted_tenant_users AS (
        INSERT INTO tenant_user (tenant_id, user_id, created_at, updated_at)
        SELECT ${BigInt(tenantId)}, user_id, NOW(), NOW()
        FROM eligible
        RETURNING id
      ),
      inserted_roles AS (
        INSERT INTO model_has_roles (role_id, model_type, model_id)
        SELECT ${role.id}, ${MODEL_TYPE_TENANT_USER}, id
        FROM (
          SELECT id FROM eligible_existing
          UNION
          SELECT id FROM inserted_tenant_users
        ) target
        ON CONFLICT DO NOTHING
        RETURNING model_id
      )
      SELECT COUNT(*)::bigint AS count FROM inserted_roles
    `
    const createdRows = Number(insertResult[0]?.count ?? 0)

    const operatorTotalRows = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(DISTINCT tu.id)::bigint AS count
      FROM tenant_user tu
      INNER JOIN model_has_roles mhr ON mhr.model_type = ${MODEL_TYPE_TENANT_USER} AND mhr.model_id = tu.id
      INNER JOIN roles r ON r.id = mhr.role_id AND r.name = 'operator'
      WHERE tu.tenant_id = ${BigInt(tenantId)}
    `.then((r) => Number(r[0]?.count ?? 0))

    logEvent('info', 'tenant.operator_bulk_imported', {
      adminId: admin.sub,
      tenantId,
      created: createdRows,
      skipped: preview.totalRows - createdRows,
    })

    return Response.json({
      ...preview,
      operatorTotalRows,
      createdRows,
      skippedRows: preview.totalRows - createdRows,
    })
  } catch (error) {
    return apiError(error)
  }
}
