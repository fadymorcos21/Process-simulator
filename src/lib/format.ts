export function formatNumber(value: number, fractionDigits = 0): string {
  if (!Number.isFinite(value)) {
    return 'N/A'
  }

  return value.toLocaleString(undefined, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })
}

export function formatPercent(value: number, fractionDigits = 1): string {
  if (!Number.isFinite(value)) {
    return 'N/A'
  }

  return `${formatNumber(value, fractionDigits)}%`
}

export function formatDelta(value: number): string {
  if (!Number.isFinite(value)) {
    return 'N/A'
  }

  if (value > 0) {
    return `+${formatNumber(value, 0)}`
  }

  return formatNumber(value, 0)
}
