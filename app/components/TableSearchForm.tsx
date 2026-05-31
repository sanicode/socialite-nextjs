type Props = {
  action: string
  defaultValue?: string
  hiddenParams?: Record<string, string | undefined>
  name?: string
  placeholder?: string
}

export default function TableSearchForm({
  action,
  defaultValue = '',
  hiddenParams = {},
  name = 'search',
  placeholder = 'Cari...',
}: Props) {
  return (
    <form action={action} className="flex w-full justify-end gap-2 sm:w-auto">
      {Object.entries(hiddenParams).map(([key, value]) => (
        value ? <input key={key} type="hidden" name={key} value={value} /> : null
      ))}
      <input
        type="search"
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="h-10 min-w-0 w-full rounded-lg border border-neutral-300 bg-white px-3.5 py-2 text-sm text-neutral-900 transition focus:outline-none focus:ring-2 focus:ring-neutral-900 sm:w-72 sm:max-w-xs dark:border-neutral-700 dark:bg-neutral-800 dark:text-white dark:focus:ring-white"
      />
      <button
        type="submit"
        className="inline-flex w-auto flex-none items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-neutral-900 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35m1.6-5.4a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        Cari
      </button>
    </form>
  )
}
