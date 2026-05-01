'use client'

import { useState } from 'react'
import type { ReportRow } from '@/app/actions/dashboard'
import * as XLSX from 'xlsx'
import { getPageSlice, TABLE_PAGE_SIZE_OPTIONS, type TablePageSize } from '@/app/lib/table-pagination'

type Props = {
  data: ReportRow[]
}

export default function ReportTable({ data }: Props) {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<TablePageSize>(20)

  const columns = data.length > 0 ? Object.keys(data[0]) : []
  const { totalPages, start, end } = getPageSlice(page, pageSize, data.length)
  const currentPage = Math.min(page, totalPages)
  const pageData = pageSize === 'all' ? data : data.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  function isUrl(value: unknown): value is string {
    if (typeof value !== 'string') return false
    try { return ['http:', 'https:'].includes(new URL(value).protocol) } catch { return false }
  }

  function handleExport() {
    if (data.length === 0) return
    const ws = XLSX.utils.json_to_sheet(data)
    const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1')
    for (let R = range.s.r + 1; R <= range.e.r; R++) {
      for (let C = range.s.c; C <= range.e.c; C++) {
        const addr = XLSX.utils.encode_cell({ r: R, c: C })
        const cell = ws[addr]
        if (cell && isUrl(cell.v)) {
          cell.l = { Target: cell.v }
        }
      }
    }
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

  function getUrlLabel(column: string): string {
    if (/^amplifikasi_\d+$/i.test(column)) return 'Lihat amplifikasi'
    if (column.toLowerCase().endsWith('_screenshot')) return 'Lihat screenshot'
    return 'Buka link'
  }

  function renderCell(column: string, value: unknown) {
    const text = formatCell(value)
    if (isUrl(value)) {
      return (
        <a
          href={value}
          target="_blank"
          rel="noopener noreferrer"
          title={value}
          className="inline-flex max-w-40 items-center rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 transition hover:bg-blue-100 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-950/70"
        >
          <span className="truncate">{getUrlLabel(column)}</span>
        </a>
      )
    }
    return <span>{text}</span>
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

      <div className="flex items-center px-5 py-3">
        <label className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400">
          <select
            value={String(pageSize)}
            onChange={(e) => {
              setPageSize(e.target.value === 'all' ? 'all' : Number(e.target.value))
              setPage(1)
            }}
            className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 transition focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white dark:focus:ring-white"
          >
            {TABLE_PAGE_SIZE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option === 'all' ? 'All' : option}
              </option>
            ))}
          </select>
          <span>entri per halaman</span>
        </label>
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
                    {renderCell(col, row[col])}
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
            ? `${start}–${end} dari ${data.length.toLocaleString('id-ID')} data`
            : '0 data'}
        </p>
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(1)}
              disabled={currentPage === 1}
              className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              First
            </button>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Prev
            </button>
            <span className="text-xs text-neutral-500 dark:text-neutral-400 min-w-17.5 text-center">
              Hal. {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              Next
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <button
              onClick={() => setPage(totalPages)}
              disabled={currentPage === totalPages}
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
