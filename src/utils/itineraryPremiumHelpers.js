export function getPremiumDayTotals(restriction, dayNum) {
  if (restriction == null || dayNum == null || !Number.isFinite(Number(dayNum))) return null
  const totals = restriction.totalByDay ?? restriction.total_by_day ?? null
  const visible = restriction.visibleByDay ?? restriction.visible_by_day ?? null
  if (totals == null || visible == null) return null
  if (typeof totals !== 'object' || typeof visible !== 'object') return null

  const key = String(Math.floor(Number(dayNum)))
  const rawTotal = totals[key] ?? totals[Number(key)] ?? totals[`${Number(key)}`]
  const rawVisible = visible[key] ?? visible[Number(key)] ?? visible[`${Number(key)}`] ?? 0
  const totalOnDay =
    typeof rawTotal === 'number' && Number.isFinite(rawTotal)
      ? Math.floor(rawTotal)
      : Number(rawTotal) >= 1
        ? Number(rawTotal)
        : 0
  const visibleOnDay =
    typeof rawVisible === 'number' && Number.isFinite(rawVisible)
      ? Math.floor(rawVisible)
      : typeof rawVisible === 'string'
        ? Number(rawVisible) || 0
        : 0
  return { totalOnDay, visibleOnDay }
}

export function normalizedPremiumRestriction(restriction) {
  if (!restriction) return null
  return {
    ...restriction,
    totalByDay: restriction.totalByDay ?? restriction.total_by_day ?? null,
    visibleByDay: restriction.visibleByDay ?? restriction.visible_by_day ?? null,
  }
}
