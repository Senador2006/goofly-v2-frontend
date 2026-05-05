export function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

export function formatDateRange(start, end) {
  if (!start || !end) return ''
  return `${formatDate(start)} - ${formatDate(end)}`
}
