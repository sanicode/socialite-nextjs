type ChartBarLabelProps = {
  x?: number | string
  y?: number | string
  width?: number | string
  height?: number | string
  value?: unknown
}

function formatChartValue(value: unknown) {
  if (value === undefined || value === null || value === '') return null
  const parsed = Number(value)
  if (Number.isNaN(parsed)) return String(value)
  return parsed.toLocaleString('id-ID')
}

function toNumber(value: number | string | undefined) {
  if (value === undefined || value === null || value === '') return 0
  const parsed = Number(value)
  return Number.isNaN(parsed) ? 0 : parsed
}

export function renderHorizontalBarValueLabel({
  x = 0,
  y = 0,
  width = 0,
  height = 0,
  value,
}: ChartBarLabelProps) {
  const label = formatChartValue(value)
  if (!label) return null
  const xPos = toNumber(x)
  const yPos = toNumber(y)
  const widthValue = toNumber(width)
  const heightValue = toNumber(height)

  return (
    <text
      x={xPos + widthValue + 6}
      y={yPos + heightValue / 2}
      fill="currentColor"
      fontSize={10}
      fontWeight={600}
      textAnchor="start"
      dominantBaseline="middle"
    >
      {label}
    </text>
  )
}

export function renderVerticalBarValueLabel({
  x = 0,
  y = 0,
  width = 0,
  value,
}: ChartBarLabelProps) {
  const label = formatChartValue(value)
  if (!label) return null
  const xPos = toNumber(x)
  const yPos = toNumber(y)
  const widthValue = toNumber(width)

  return (
    <text
      x={xPos + widthValue / 2}
      y={yPos - 8}
      fill="currentColor"
      fontSize={10}
      fontWeight={600}
      textAnchor="middle"
    >
      {label}
    </text>
  )
}
