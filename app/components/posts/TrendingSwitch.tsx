'use client'

type Props = {
  checked: boolean
  disabled?: boolean
  title?: string
  onClick: () => void
}

export default function TrendingSwitch({ checked, disabled = false, title, onClick }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`ui-button-unstyled relative inline-flex h-5 w-[3.25rem] shrink-0 items-center overflow-hidden rounded-full p-0.5 transition duration-200 disabled:cursor-not-allowed disabled:opacity-50 ${
        checked
          ? 'bg-gradient-to-r from-emerald-500 to-green-600 shadow-[inset_0_1px_2px_rgba(255,255,255,0.3),inset_0_-2px_4px_rgba(0,0,0,0.18)]'
          : 'bg-gradient-to-r from-neutral-200 to-neutral-100 shadow-[inset_0_2px_4px_rgba(0,0,0,0.14)] dark:from-neutral-700 dark:to-neutral-800'
      }`}
    >
      <span
        className={`absolute select-none text-[10px] font-semibold leading-none transition ${
          checked
            ? 'left-2.5 text-white/90 drop-shadow-[0_1px_1px_rgba(0,0,0,0.25)]'
            : 'right-1.5 text-neutral-500 dark:text-neutral-300'
        }`}
      >
        {checked ? 'Ya' : 'Tidak'}
      </span>
      <span
        aria-hidden="true"
        className={`relative z-10 h-4 w-4 rounded-full bg-gradient-to-br from-white to-neutral-100 shadow-[0_3px_7px_rgba(0,0,0,0.2),inset_0_1px_1px_rgba(255,255,255,0.9)] ring-1 ring-white/80 transition-transform duration-200 ${
          checked ? 'translate-x-8' : 'translate-x-0'
        }`}
      />
    </button>
  )
}
