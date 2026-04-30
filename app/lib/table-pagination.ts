export type TablePageSize = number | 'all'

export const TABLE_PAGE_SIZE_OPTIONS = ['5', '10', '20', '50', 'all'] as const

export function parseTablePageSize(value: string | undefined, fallback: number): TablePageSize {
  if (value === 'all') return 'all'

  const parsed = Number(value)
  return [5, 10, 20, 50].includes(parsed) ? parsed : fallback
}

export function getPageSlice(page: number, pageSize: TablePageSize, total: number) {
  if (pageSize === 'all') {
    return {
      offset: 0,
      take: undefined,
      totalPages: 1,
      start: total > 0 ? 1 : 0,
      end: total,
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const currentPage = Math.min(Math.max(1, page), totalPages)
  const start = total > 0 ? (currentPage - 1) * pageSize + 1 : 0
  const end = Math.min(currentPage * pageSize, total)

  return {
    offset: (currentPage - 1) * pageSize,
    take: pageSize,
    totalPages,
    start,
    end,
  }
}

