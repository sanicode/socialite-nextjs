'use client'

import * as XLSX from 'xlsx'

type CitySummary = {
  province: string
  city: string
  quota: number
  counts: Record<string, number>
}

type ProvinceSummary = {
  province: string
  label: string
  quota: number
  counts: Record<string, number>
}

type Props = {
  month: string
  monthLabel: string
  dates: string[]
  cityRows: CitySummary[]
  provinceTotals: ProvinceSummary[]
  dailyTotals: Record<string, number>
  totalQuota: number
}

function formatSheetName(value: string) {
  return value.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31)
}

function dayLabel(date: string) {
  return Number(date.slice(-2))
}

export default function SummaryExcelButton({
  month,
  monthLabel,
  dates,
  cityRows,
  provinceTotals,
  dailyTotals,
  totalQuota,
}: Props) {
  function handleDownload() {
    const provinceNames = Array.from(new Set(cityRows.map((row) => row.province))).sort((a, b) => a.localeCompare(b, 'id'))
    const rowsByProvince = new Map(
      provinceNames.map((province) => [province, cityRows.filter((row) => row.province === province)])
    )

    const aoa: Array<Array<string | number>> = [
      [`REKAP DATA ${monthLabel.toUpperCase()}`],
      [],
      ['WILAYAH', '', 'JUMLAH KUOTA', 'DATA MASUK', ...Array(Math.max(0, dates.length - 1)).fill('')],
      ['', '', '', ...dates.map(dayLabel)],
    ]

    for (const province of provinceNames) {
      aoa.push([province])
      const rows = rowsByProvince.get(province) ?? []
      rows.forEach((row, index) => {
        aoa.push([
          index + 1,
          row.city,
          row.quota,
          ...dates.map((date) => row.counts[date] || ''),
        ])
      })
    }

    aoa.push([
      'JUMLAH',
      '',
      totalQuota,
      ...dates.map((date) => dailyTotals[date] || ''),
    ])
    aoa.push([])
    aoa.push(['TANGGAL', '', 'KUOTA', ...dates.map(dayLabel)])
    for (const row of provinceTotals) {
      aoa.push([
        row.label,
        '',
        row.quota,
        ...dates.map((date) => row.counts[date] || ''),
      ])
    }
    aoa.push([])
    aoa.push(['Catatan :'])
    aoa.push(['Warna dan card statistik halaman web tidak disertakan dalam export Excel.'])

    const workbook = XLSX.utils.book_new()
    const worksheet = XLSX.utils.aoa_to_sheet(aoa)
    const lastColumn = dates.length + 2

    worksheet['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: lastColumn } },
      { s: { r: 2, c: 0 }, e: { r: 3, c: 1 } },
      { s: { r: 2, c: 2 }, e: { r: 3, c: 2 } },
      { s: { r: 2, c: 3 }, e: { r: 2, c: lastColumn } },
    ]
    worksheet['!cols'] = [
      { wch: 8 },
      { wch: 26 },
      { wch: 13 },
      ...dates.map(() => ({ wch: 8 })),
    ]
    worksheet['!freeze'] = { xSplit: 3, ySplit: 4 }

    XLSX.utils.book_append_sheet(workbook, worksheet, formatSheetName(monthLabel))

    const chartData = [
      ['TANGGAL', ...provinceTotals.map((row) => row.label)],
      ['KUOTA', ...provinceTotals.map((row) => row.quota)],
      ...dates.map((date) => [
        `${dayLabel(date)}-${new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'Asia/Jakarta' }).format(new Date(`${date}T00:00:00+07:00`))}`,
        ...provinceTotals.map((row) => row.counts[date] || 0),
      ]),
    ]
    const chartSheet = XLSX.utils.aoa_to_sheet(chartData)
    chartSheet['!cols'] = [{ wch: 12 }, ...provinceTotals.map(() => ({ wch: 12 }))]
    XLSX.utils.book_append_sheet(workbook, chartSheet, 'Data Chart')

    XLSX.writeFile(workbook, `summary-${month}.xlsx`)
  }

  return (
    <button
      type="button"
      onClick={handleDownload}
      className="summary-no-print inline-flex items-center gap-2 rounded-lg border border-neutral-300 px-4 py-2.5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
    >
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M7 3h10a2 2 0 012 2v14a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M8 8h8M8 12h8M8 16h4" />
      </svg>
      Download Excel
    </button>
  )
}

