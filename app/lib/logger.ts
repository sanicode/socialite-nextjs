type LogLevel = 'info' | 'warn' | 'error'

function serializeDetails(details: Record<string, unknown>) {
  return JSON.parse(
    JSON.stringify(details, (_key, value) => {
      if (typeof value === 'bigint') return value.toString()
      if (value instanceof Error) {
        return {
          name: value.name,
          message: value.message,
        }
      }
      return value
    })
  )
}

export function logEvent(level: LogLevel, event: string, details: Record<string, unknown> = {}) {
  const payload = {
    level,
    event,
    timestamp: new Date().toISOString(),
    ...serializeDetails(details),
  }

  if (level === 'error') {
    console.error(payload)
    return
  }

  if (level === 'warn') {
    console.warn(payload)
    return
  }

  console.info(payload)
}
