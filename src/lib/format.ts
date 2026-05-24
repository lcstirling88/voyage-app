import { format, formatDistanceToNowStrict, differenceInDays, isSameDay } from 'date-fns'

export function fmtMoney(amount: number | null | undefined, currency = 'AUD') {
  if (amount == null) return '—'
  const symbol = currency === 'AUD' || currency === 'USD' ? '$' : currency === 'JPY' ? '¥' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : ''
  const rounded = currency === 'JPY' ? Math.round(amount) : amount.toFixed(0)
  return `${symbol}${Number(rounded).toLocaleString()}`
}

export function fmtMoneyFull(amount: number | null | undefined, currency = 'AUD') {
  if (amount == null) return '—'
  const symbol = currency === 'AUD' || currency === 'USD' ? '$' : currency === 'JPY' ? '¥' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : ''
  return `${symbol}${amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

export function fmtDate(date: Date, pattern = 'MMM d') {
  return format(date, pattern)
}

export function fmtDateLong(date: Date) {
  return format(date, 'EEEE, MMM d, yyyy')
}

export function fmtTime(date: Date) {
  return format(date, 'HH:mm')
}

export function fmtDateRange(start: Date, end: Date) {
  if (isSameDay(start, end)) return fmtDate(start)
  if (start.getMonth() === end.getMonth()) {
    return `${format(start, 'MMM d')} – ${format(end, 'd, yyyy')}`
  }
  return `${format(start, 'MMM d')} – ${format(end, 'MMM d, yyyy')}`
}

export function daysUntil(date: Date) {
  return Math.max(0, differenceInDays(date, new Date()))
}

export function relativeFromNow(date: Date) {
  return formatDistanceToNowStrict(date, { addSuffix: true })
}

export function safeJson<T = unknown>(s: string | null | undefined): T | null {
  if (!s) return null
  try { return JSON.parse(s) as T } catch { return null }
}
