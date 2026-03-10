export function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function formatDateRange(start, end) {
  if (!start || !end) return ''
  return `${formatDate(start)} - ${formatDate(end)}`
}
