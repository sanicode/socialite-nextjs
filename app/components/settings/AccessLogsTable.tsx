'use client'

import type { AccessLogRow } from '@/app/lib/access-logs'

type Props = {
  logs: AccessLogRow[]
  isLoading?: boolean
}

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export default function AccessLogsTable({ logs, isLoading = false }: Props) {
  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-800">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-800/50">
              <th className="px-4 py-3 text-left font-medium text-neutral-600 dark:text-neutral-400">Timestamp</th>
              <th className="px-4 py-3 text-left font-medium text-neutral-600 dark:text-neutral-400">Event</th>
              <th className="px-4 py-3 text-left font-medium text-neutral-600 dark:text-neutral-400">Path</th>
              <th className="px-4 py-3 text-left font-medium text-neutral-600 dark:text-neutral-400">Status</th>
              <th className="px-4 py-3 text-left font-medium text-neutral-600 dark:text-neutral-400">IP / Negara</th>
              <th className="px-4 py-3 text-left font-medium text-neutral-600 dark:text-neutral-400">User</th>
              <th className="px-4 py-3 text-left font-medium text-neutral-600 dark:text-neutral-400">Browser / Device</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {isLoading && Array.from({ length: 8 }).map((_, index) => (
              <tr key={`logs-skeleton-${index}`} className="bg-white align-top dark:bg-neutral-900">
                <td className="px-4 py-3">
                  <div className="h-4 w-32 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
                </td>
                <td className="px-4 py-3">
                  <div className="h-4 w-28 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
                </td>
                <td className="px-4 py-3">
                  <div className="h-4 w-48 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
                </td>
                <td className="px-4 py-3">
                  <div className="h-5 w-16 animate-pulse rounded-full bg-neutral-200 dark:bg-neutral-700" />
                </td>
                <td className="px-4 py-3">
                  <div className="h-4 w-24 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
                </td>
                <td className="px-4 py-3">
                  <div className="h-4 w-36 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
                </td>
                <td className="px-4 py-3">
                  <div className="h-4 w-44 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
                </td>
              </tr>
            ))}

            {!isLoading && logs.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-neutral-500 dark:text-neutral-400">
                  Belum ada log akses.
                </td>
              </tr>
            )}
            {!isLoading && logs.map((log) => (
              <tr key={log.id} className="bg-white align-top transition hover:bg-neutral-50 dark:bg-neutral-900 dark:hover:bg-neutral-800/50">
                <td className="px-4 py-3 text-xs text-neutral-600 dark:text-neutral-400 whitespace-nowrap">
                  {formatTimestamp(log.created_at)}
                </td>
                <td className="px-4 py-3">
                  <div className="space-y-1">
                    <p className="font-medium text-neutral-900 dark:text-white">{log.event_type}</p>
                    {log.method && (
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">{log.method}</p>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="max-w-[18rem] space-y-1">
                    <p className="truncate font-mono text-xs text-neutral-900 dark:text-white">{log.request_path ?? '—'}</p>
                    {log.referer && (
                      <p className="truncate text-xs text-neutral-500 dark:text-neutral-400">
                        Ref: {log.referer}
                      </p>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                    log.status === 'allowed' || log.status === 'success'
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                      : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                  }`}>
                    {log.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-neutral-600 dark:text-neutral-400">
                  <div>{log.ip ?? '—'}</div>
                  <div className="mt-1 font-mono">{log.country ?? '—'}</div>
                </td>
                <td className="px-4 py-3 text-xs text-neutral-600 dark:text-neutral-400">
                  <div>{log.user_email ?? 'Guest'}</div>
                  {log.user_id && <div className="mt-1 font-mono">ID {log.user_id}</div>}
                </td>
                <td className="px-4 py-3 text-xs text-neutral-600 dark:text-neutral-400">
                  <div>{log.browser ?? 'Unknown'} / {log.os ?? 'Unknown'}</div>
                  <div className="mt-1">{log.device_type ?? 'unknown'}</div>
                  {log.user_agent && (
                    <p className="mt-2 max-w-[20rem] whitespace-normal break-words text-[11px] text-neutral-500 dark:text-neutral-500">
                      {log.user_agent}
                    </p>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
