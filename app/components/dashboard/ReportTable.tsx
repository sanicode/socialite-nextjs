'use client'

import { useState } from 'react'
import type { ReportRow } from '@/app/actions/dashboard'
import * as XLSX from 'xlsx'

type Props = {
  data: ReportRow[]
}

const PAGE_SIZE = 25

export default function ReportTable({ data }: Props) {
  const [page, setPage] = useState(1)

  const columns = data.length > 0 ? Object.keys(data[0]) : []
  const totalPages = Math.max(1, Math.ceil(data.length / PAGE_SIZE))
  const pageData = data.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function handleExport() {
    if (data.length === 0) return
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Rekapitulasi')
    XLSX.writeFile(wb, `rekapitulasi_pelaporan_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  function formatHeader(key: string): string {
    return key
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
  }

  function formatCell(value: unknown): string {
    if (value === null || value === undefined) return '—'
    if (value instanceof Date) {
      return value.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
    }
    return String(value)
  }

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200 dark:border-neutral-800">
        <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">
          Rekapitulasi Pelaporan
        </h3>
        <button
          onClick={handleExport}
          disabled={data.length === 0}
          className="inline-flex items-center gap-2 text-xs px-3.5 py-2 rounded-lg bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-medium hover:bg-neutral-700 dark:hover:bg-neutral-100 transition disabled:opacity-50"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Download Excel
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-neutral-50 dark:bg-neutral-800/50 border-b border-neutral-200 dark:border-neutral-800">
              {columns.map((col) => (
                <th
                  key={col}
                  className="text-left px-4 py-3 font-medium text-neutral-600 dark:text-neutral-400 whitespace-nowrap"
                >
                  {formatHeader(col)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {data.length === 0 && (
              <tr>
                <td
                  colSpan={columns.length || 1}
                  className="px-4 py-12 text-center text-neutral-500 dark:text-neutral-400"
                >
                  Belum ada data.
                </td>
              </tr>
            )}
            {pageData.map((row, i) => (
              <tr
                key={i}
                className="bg-white dark:bg-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition"
              >
                {columns.map((col) => (
                  <td
                    key={col}
                    className="px-4 py-3 text-neutral-700 dark:text-neutral-300 whitespace-nowrap"
                  >
                    {formatCell(row[col])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="px-5 py-3 border-t border-neutral-200 dark:border-neutral-800 flex flex-col items-start gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          {data.length > 0
            ? `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, data.length)} dari ${data.length.toLocaleString('id-ID')} data`
            : '0 data'}
        </p>
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(1)}
              disabled={page === 1}
              className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              First
            </button>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Prev
            </button>
            <span className="text-xs text-neutral-500 dark:text-neutral-400 min-w-17.5 text-center">
              Hal. {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              Next
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <button
              onClick={() => setPage(totalPages)}
              disabled={page === totalPages}
              className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              Last
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
