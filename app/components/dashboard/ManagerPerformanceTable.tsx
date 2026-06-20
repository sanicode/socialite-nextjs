'use client'

import { useState } from 'react'
import type { ManagerPerformanceRow } from '@/app/actions/dashboard'
import { getPageSlice, TABLE_PAGE_SIZE_OPTIONS, type TablePageSize } from '@/app/lib/table-pagination'
import * as XLSX from 'xlsx'

type Props = {
  data: ManagerPerformanceRow[]
  dateFrom: string
  dateTo: string
}

function formatDate(value: string) {
  return new Date(`${value}T00:00:00+07:00`).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function formatDateRange(dateFrom: string, dateTo: string) {
  if (dateFrom === dateTo) return formatDate(dateFrom)
  return `${formatDate(dateFrom)} – ${formatDate(dateTo)}`
}

function pct(part: number, total: number) {
  if (total === 0) return null
  return Math.round((part / total) * 100)
}

function skor(dilihat: number, divalidasi: number, total: number) {
  if (total === 0) return null
  return Math.round(((dilihat / total) + (divalidasi / total)) / 2 * 100)
}

function CountCell({ count, total }: { count: number; total: number }) {
  const p = pct(count, total)
  return (
    <span className="tabular-nums">
      {count.toLocaleString('id-ID')}
      {p !== null && (
        <span className="ml-1 text-neutral-400 dark:text-neutral-500">({p}%)</span>
      )}
    </span>
  )
}

export default function ManagerPerformanceTable({ data, dateFrom, dateTo }: Props) {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<TablePageSize>(20)
  const { totalPages, start, end } = getPageSlice(page, pageSize, data.length)
  const currentPage = Math.min(page, totalPages)
  const pageData = pageSize === 'all' ? data : data.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const tanggalLabel = formatDateRange(dateFrom, dateTo)

  function handleExport() {
    if (data.length === 0) return
    const rows = data.map((row, index) => ({
      No: index + 1,
      Tanggal: tanggalLabel,
      Nama: row.managerName,
      Provinsi: row.provinsi ?? '-',
      'Kab/Kota': row.kabKota ?? '-',
      'Total Record Laporan': row.totalLaporan,
      Dilihat: row.dilihat,
      'Dilihat (%)': row.totalLaporan > 0 ? `${pct(row.dilihat, row.totalLaporan)}%` : '-',
      Divalidasi: row.divalidasi,
      'Divalidasi (%)': row.totalLaporan > 0 ? `${pct(row.divalidasi, row.totalLaporan)}%` : '-',
      'Skor (%)': row.totalLaporan > 0 ? `${skor(row.dilihat, row.divalidasi, row.totalLaporan)}%` : '-',
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    ws['!cols'] = [
      { wch: 6 }, { wch: 24 }, { wch: 28 }, { wch: 22 }, { wch: 24 },
      { wch: 20 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 12 },
    ]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Kinerja Fasilitator Daerah')
    XLSX.writeFile(wb, `kinerja_fasilitator_daerah_${dateFrom}_${dateTo}.xlsx`)
  }

  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex flex-col gap-3 border-b border-neutral-200 px-5 py-4 dark:border-neutral-800 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">
            Kinerja Fasilitator Daerah — {tanggalLabel}
          </h3>
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
            {data.length.toLocaleString('id-ID')} fasilitator daerah terdaftar.
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
              <th className="w-12 px-4 py-3 text-left font-medium text-neutral-600 dark:text-neutral-400">No</th>
              <th className="px-4 py-3 text-left font-medium text-neutral-600 dark:text-neutral-400">Tanggal</th>
              <th className="px-4 py-3 text-left font-medium text-neutral-600 dark:text-neutral-400">Nama</th>
              <th className="px-4 py-3 text-left font-medium text-neutral-600 dark:text-neutral-400">Provinsi</th>
              <th className="px-4 py-3 text-left font-medium text-neutral-600 dark:text-neutral-400">Kab/Kota</th>
              <th className="px-4 py-3 text-center font-medium text-neutral-600 dark:text-neutral-400">Total Laporan</th>
              <th className="px-4 py-3 text-center font-medium text-neutral-600 dark:text-neutral-400">Dilihat</th>
              <th className="px-4 py-3 text-center font-medium text-neutral-600 dark:text-neutral-400">Divalidasi</th>
              <th className="px-4 py-3 text-center font-medium text-neutral-600 dark:text-neutral-400">Skor</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {data.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-neutral-500 dark:text-neutral-400">
                  Belum ada data kinerja fasilitator daerah.
                </td>
              </tr>
            )}
            {pageData.map((row, index) => (
              <tr key={row.managerId} className="bg-white transition hover:bg-neutral-50 dark:bg-neutral-900 dark:hover:bg-neutral-800/50">
                <td className="px-4 py-3 text-neutral-500 dark:text-neutral-400">
                  {pageSize === 'all' ? index + 1 : start + index}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-neutral-700 dark:text-neutral-300">
                  {tanggalLabel}
                </td>
                <td className="whitespace-nowrap px-4 py-3 font-medium text-neutral-900 dark:text-white">
                  {row.managerName}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-neutral-700 dark:text-neutral-300">
                  {row.provinsi ?? '-'}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-neutral-700 dark:text-neutral-300">
                  {row.kabKota ?? '-'}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-center tabular-nums text-neutral-700 dark:text-neutral-300">
                  {row.totalLaporan.toLocaleString('id-ID')}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-center text-neutral-700 dark:text-neutral-300">
                  <CountCell count={row.dilihat} total={row.totalLaporan} />
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-center text-neutral-700 dark:text-neutral-300">
                  <CountCell count={row.divalidasi} total={row.totalLaporan} />
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-center font-medium text-neutral-900 dark:text-white tabular-nums">
                  {skor(row.dilihat, row.divalidasi, row.totalLaporan) !== null
                    ? `${skor(row.dilihat, row.divalidasi, row.totalLaporan)}%`
                    : '-'}
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
              onClick={() => setPage((v) => Math.max(1, v - 1))}
              disabled={currentPage === 1}
              className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 px-3 py-1.5 text-xs text-neutral-600 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Prev
            </button>
            <span className="min-w-17.5 text-center text-xs text-neutral-500 dark:text-neutral-400">
              Hal. {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((v) => Math.min(totalPages, v + 1))}
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
