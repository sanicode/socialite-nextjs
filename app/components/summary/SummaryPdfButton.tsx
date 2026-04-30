'use client'

type Props = {
  filename: string
}

export default function SummaryPdfButton({ filename }: Props) {
  function handlePrint() {
    const previousTitle = document.title
    document.title = filename
    window.print()
    window.setTimeout(() => {
      document.title = previousTitle
    }, 500)
  }

  return (
    <button
      type="button"
      onClick={handlePrint}
      className="summary-no-print inline-flex items-center gap-2 rounded-lg border border-neutral-300 px-4 py-2.5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
    >
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M7 3h7l5 5v13H7a2 2 0 01-2-2V5a2 2 0 012-2z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M14 3v5h5M8 15h1.5a1.5 1.5 0 000-3H8v6m6-6v6m0-6h1.2a2.8 2.8 0 010 5.6H14m5-5.6h-2.5V18" />
      </svg>
      Download PDF
    </button>
  )
}
