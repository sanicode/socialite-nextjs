import { type Instrumentation } from 'next'

export async function register() {
}

function getErrorRecord(error: unknown) {
  if (error instanceof Error) {
    const digest = (error as Error & { digest?: unknown }).digest

    return {
      digest: typeof digest === 'string' ? digest : undefined,
      name: error.name,
      message: error.message,
      stack: error.stack,
    }
  }

  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>

    return {
      digest: typeof record.digest === 'string' ? record.digest : undefined,
      name: typeof record.name === 'string' ? record.name : undefined,
      message: typeof record.message === 'string' ? record.message : undefined,
      stack: typeof record.stack === 'string' ? record.stack : undefined,
    }
  }

  return {
    message: String(error),
  }
}

function getErrorCause(error: unknown) {
  if (!error || typeof error !== 'object') return undefined

  const cause = (error as { cause?: unknown }).cause
  if (!cause) return undefined

  if (cause instanceof Error) {
    return {
      name: cause.name,
      message: cause.message,
      stack: cause.stack,
    }
  }

  if (typeof cause === 'object') {
    const record = cause as Record<string, unknown>
    return {
      name: typeof record.name === 'string' ? record.name : undefined,
      message: typeof record.message === 'string' ? record.message : undefined,
      code: typeof record.code === 'string' ? record.code : undefined,
      originalCode: typeof record.originalCode === 'string' ? record.originalCode : undefined,
      originalMessage: typeof record.originalMessage === 'string' ? record.originalMessage : undefined,
    }
  }

  return { message: String(cause) }
}

export const onRequestError: Instrumentation.onRequestError = (error, request, context) => {
  const errorRecord = getErrorRecord(error)

  console.error('[next-request-error]', {
    digest: errorRecord.digest,
    name: errorRecord.name,
    message: errorRecord.message,
    stack: errorRecord.stack,
    cause: getErrorCause(error),
    request: {
      method: request.method,
      path: request.path,
    },
    context,
  })
}
