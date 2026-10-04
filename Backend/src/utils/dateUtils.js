function dateOrdinal(date, timezone) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(date).map(({ type, value }) => [type, value]))
  return Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day))
}

export function overdueDays(dueDate, returnDate = new Date(), timezone = Intl.DateTimeFormat().resolvedOptions().timeZone) {
  const difference = dateOrdinal(new Date(returnDate), timezone) - dateOrdinal(new Date(dueDate), timezone)
  return Math.max(0, Math.ceil(difference / 86_400_000))
}

export function addDays(date, days) {
  const value = new Date(date)
  value.setDate(value.getDate() + days)
  return value
}
