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
    <form action={action} className="flex justify-end">
      {Object.entries(hiddenParams).map(([key, value]) => (
        value ? <input key={key} type="hidden" name={key} value={value} /> : null
      ))}
      <input
        type="search"
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="w-full rounded-lg border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 transition focus:outline-none focus:ring-2 focus:ring-neutral-900 sm:max-w-xs dark:border-neutral-700 dark:bg-neutral-800 dark:text-white dark:focus:ring-white"
      />
    </form>
  )
}
