'use client'

import { useState } from 'react'
import type { TrendingReportRow } from '@/app/actions/dashboard'
import { getPageSlice, TABLE_PAGE_SIZE_OPTIONS, type TablePageSize } from '@/app/lib/table-pagination'
import * as XLSX from 'xlsx'

type Props = {
  data: TrendingReportRow[]
}

function isUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol)
  } catch {
    return false
  }
}

function formatDate(value: string | null) {
  if (!value) return '-'
  return new Date(`${value}T00:00:00+07:00`).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function displayValue(value: string | null) {
  return value?.trim() || '-'
}

export default function TrendingReportTable({ data }: Props) {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<TablePageSize>(20)
  const { totalPages, start, end } = getPageSlice(page, pageSize, data.length)
  const currentPage = Math.min(page, totalPages)
  const pageData = pageSize === 'all' ? data : data.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  function handleExport() {
    if (data.length === 0) return

    const rows = data.map((row, index) => ({
      No: index + 1,
      Tanggal: formatDate(row.tanggal),
      Nama: row.nama,
      Provinsi: displayValue(row.provinsi),
      'Kabupaten/Kota': displayValue(row.kabupatenKota),
      'Jenis Medsos': displayValue(row.jenisMedsos),
      Link: displayValue(row.link),
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1')
    for (let R = range.s.r + 1; R <= range.e.r; R++) {
      const addr = XLSX.utils.encode_cell({ r: R, c: 6 })
      const cell = ws[addr]
      if (cell && isUrl(cell.v)) {
        cell.l = { Target: cell.v }
      }
    }
    ws['!cols'] = [
      { wch: 8 },
      { wch: 16 },
      { wch: 28 },
      { wch: 22 },
      { wch: 24 },
      { wch: 18 },
      { wch: 48 },
    ]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Trending')
    XLSX.writeFile(wb, `daftar_pelaporan_trending_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex flex-col gap-3 border-b border-neutral-200 px-5 py-4 dark:border-neutral-800 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">
            Daftar Pelaporan Trending
          </h3>
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
            {data.length.toLocaleString('id-ID')} laporan ditandai trending.
          </p>
        </div>
        <button
          type="button"
          onClick={handleExport}
          disabled={data.length === 0}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-neutral-900 px-3.5 py-2 text-xs font-medium text-white transition hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Download Excel
        </button>
      </div>

      <div className="flex items-center px-5 py-3">
        <label className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400">
          <select
            value={String(pageSize)}
            onChange={(event) => {
              setPageSize(event.target.value === 'all' ? 'all' : Number(event.target.value))
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
            <tr className="border-b border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-800/50">
              <th className="w-16 px-4 py-3 text-left font-medium text-neutral-600 dark:text-neutral-400">No</th>
              <th className="px-4 py-3 text-left font-medium text-neutral-600 dark:text-neutral-400">Tanggal</th>
              <th className="px-4 py-3 text-left font-medium text-neutral-600 dark:text-neutral-400">Nama</th>
              <th className="px-4 py-3 text-left font-medium text-neutral-600 dark:text-neutral-400">Provinsi</th>
              <th className="px-4 py-3 text-left font-medium text-neutral-600 dark:text-neutral-400">Kabupaten/Kota</th>
              <th className="px-4 py-3 text-left font-medium text-neutral-600 dark:text-neutral-400">Jenis Medsos</th>
              <th className="px-4 py-3 text-left font-medium text-neutral-600 dark:text-neutral-400">Link</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {data.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-neutral-500 dark:text-neutral-400">
                  Belum ada pelaporan trending.
                </td>
              </tr>
            )}
            {pageData.map((row, index) => (
              <tr key={row.id} className="bg-white transition hover:bg-neutral-50 dark:bg-neutral-900 dark:hover:bg-neutral-800/50">
                <td className="px-4 py-3 text-neutral-500 dark:text-neutral-400">
                  {pageSize === 'all' ? index + 1 : start + index}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-neutral-700 dark:text-neutral-300">
                  {formatDate(row.tanggal)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 font-medium text-neutral-900 dark:text-white">
                  {row.nama}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-neutral-700 dark:text-neutral-300">
                  {displayValue(row.provinsi)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-neutral-700 dark:text-neutral-300">
                  {displayValue(row.kabupatenKota)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-neutral-700 dark:text-neutral-300">
                  {displayValue(row.jenisMedsos)}
                </td>
                <td className="px-4 py-3">
                  {isUrl(row.link) ? (
                    <a
                      href={row.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={row.link}
                      className="inline-flex max-w-56 items-center rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 transition hover:bg-blue-100 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-950/70"
                    >
                      <span className="truncate">Buka link</span>
                    </a>
                  ) : (
                    <span className="text-neutral-500 dark:text-neutral-400">{displayValue(row.link)}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col items-start gap-3 border-t border-neutral-200 px-5 py-3 dark:border-neutral-800 sm:flex-row sm:flex-wrap sm:items-center">
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          {data.length > 0
            ? `${start}–${end} dari ${data.length.toLocaleString('id-ID')} data`
            : '0 data'}
        </p>
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage(1)}
              disabled={currentPage === 1}
              className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 px-3 py-1.5 text-xs text-neutral-600 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
            >
              First
            </button>
            <button
              type="button"
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              disabled={currentPage === 1}
              className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 px-3 py-1.5 text-xs text-neutral-600 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Prev
            </button>
            <span className="min-w-[4.375rem] text-center text-xs text-neutral-500 dark:text-neutral-400">
              Hal. {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
              disabled={currentPage === totalPages}
              className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 px-3 py-1.5 text-xs text-neutral-600 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
            >
              Next
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => setPage(totalPages)}
              disabled={currentPage === totalPages}
              className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 px-3 py-1.5 text-xs text-neutral-600 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
            >
              Last
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
