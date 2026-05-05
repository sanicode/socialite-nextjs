const DATABASE_CONNECTION_ERROR_MESSAGE =
  'Aplikasi belum dapat terhubung ke database. Silakan coba lagi beberapa saat. Jika masalah berlanjut, hubungi administrator.'

const DATABASE_SCHEMA_ERROR_MESSAGE =
  'Struktur database belum siap atau tidak sesuai dengan aplikasi. Pastikan migration/schema database sudah dijalankan pada database yang sedang dipakai.'

const DATABASE_CONNECTION_ERROR_TITLE = 'Database tidak tersedia'
const DATABASE_SCHEMA_ERROR_TITLE = 'Struktur database belum siap'

const DATABASE_ERROR_PATTERNS = [
  'P1000',
  'P1001',
  'P1002',
  'P1017',
  'PrismaClientInitializationError',
  "Can't reach database server",
  'Can\'t connect to PostgreSQL server',
  'Connection terminated unexpectedly',
  'Connection refused',
  'Timed out fetching a new connection',
  'ECONNREFUSED',
  'ECONNRESET',
  'ENOTFOUND',
  'ETIMEDOUT',
  'EHOSTUNREACH',
]

const DATABASE_SCHEMA_ERROR_PATTERNS = [
  'P2021',
  'P2022',
  'does not exist in the current database',
  'The table',
  'The column',
  'relation',
  'does not exist',
  'no such table',
]

function getErrorParts(error: unknown, depth = 0): string[] {
  if (!error || depth > 3) return []

  if (typeof error === 'string') return [error]
  if (typeof error !== 'object') return []

  const record = error as {
    code?: unknown
    name?: unknown
    message?: unknown
    stack?: unknown
    cause?: unknown
  }

  return [
    typeof record.code === 'string' ? record.code : '',
    typeof record.name === 'string' ? record.name : '',
    typeof record.message === 'string' ? record.message : '',
    typeof record.stack === 'string' ? record.stack : '',
    ...getErrorParts(record.cause, depth + 1),
  ].filter(Boolean)
}

export function isDatabaseConnectionError(error: unknown) {
  const text = getErrorParts(error).join('\n')
  return DATABASE_ERROR_PATTERNS.some((pattern) => text.includes(pattern))
}

export function isDatabaseSchemaError(error: unknown) {
  const text = getErrorParts(error).join('\n')
  return DATABASE_SCHEMA_ERROR_PATTERNS.some((pattern) => text.includes(pattern))
}

export function getDatabaseConnectionErrorMessage() {
  return DATABASE_CONNECTION_ERROR_MESSAGE
}

export function getDatabaseSchemaErrorMessage() {
  return DATABASE_SCHEMA_ERROR_MESSAGE
}

export function getSafeApplicationError(error: unknown) {
  if (isDatabaseSchemaError(error)) {
    return {
      title: DATABASE_SCHEMA_ERROR_TITLE,
      message: DATABASE_SCHEMA_ERROR_MESSAGE,
      code: 'DATABASE_SCHEMA_NOT_READY',
    }
  }

  if (isDatabaseConnectionError(error)) {
    return {
      title: DATABASE_CONNECTION_ERROR_TITLE,
      message: DATABASE_CONNECTION_ERROR_MESSAGE,
      code: 'DATABASE_UNAVAILABLE',
    }
  }

  return {
    title: 'Terjadi kesalahan',
    message: 'Aplikasi tidak dapat memproses permintaan saat ini. Silakan coba lagi.',
    code: 'APPLICATION_ERROR',
  }
}
