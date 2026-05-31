'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'

/**
 * One cancellation deadline on the calendar — the last moment a booking can be
 * cancelled (cancelByAt). All display strings are pre-formatted server-side so
 * this component ships no date/currency logic and can't disagree with the rest
 * of the page. Bookings with no deadline (non-refundable / unknown terms) don't
 * appear here — they live in the editable terms list below the calendar.
 */
export type CancelEvent = {
  id: string
  label: string
  /** YYYY-MM-DD of cancelByAt — used for both grid placement and sorting. */
  dateISO: string
  dateLabel: string
  /** open = window comfortably open · soon = shuts within a week · closed = passed. */
  state: 'open' | 'soon' | 'closed'
  /** Human refund position, e.g. "Full refund", "$200 back", "Non-refundable". */
  refundLabel: string
  /** Tight token for the calendar cell, e.g. "Free", "$200", "—". */
  compactRefund: string
  /** One-line policy summary. */
  detail: string
}

const CELL: Record<CancelEvent['state'], string> = {
  open: 'border-2 border-sage bg-sage-soft',
  soon: 'border-2 border-gold bg-gold-soft',
  closed: 'border-2 border-line bg-line-soft',
}
const DOT: Record<CancelEvent['state'], string> = {
  open: 'bg-sage',
  soon: 'bg-gold',
  closed: 'bg-ink-muted/40',
}
const TXT: Record<CancelEvent['state'], string> = {
  open: 'text-sage',
  soon: 'text-gold',
  closed: 'text-ink-muted',
}

// A deadline closing soon is the most attention-worthy when a day stacks several.
const PRIORITY: Record<CancelEvent['state'], number> = { soon: 2, open: 1, closed: 0 }
function dominant(events: CancelEvent[]): CancelEvent['state'] {
  return events.reduce<CancelEvent['state']>(
    (acc, e) => (PRIORITY[e.state] > PRIORITY[acc] ? e.state : acc),
    'closed',
  )
}

const pad = (n: number) => String(n).padStart(2, '0')

export function CancellationCalendarClient({
  events,
  todayISO,
  initialYear,
  initialMonth,
}: {
  events: CancelEvent[]
  todayISO: string
  initialYear: number
  initialMonth: number // 0-based
}) {
  const [vy, setVy] = useState(initialYear)
  const [vm, setVm] = useState(initialMonth)
  const [selected, setSelected] = useState<string | null>(null)

  function shift(delta: number) {
    let m = vm + delta
    let y = vy
    if (m < 0) { m = 11; y -= 1 }
    if (m > 11) { m = 0; y += 1 }
    setVm(m)
    setVy(y)
    setSelected(null)
  }

  const byDay = new Map<string, CancelEvent[]>()
  for (const e of events) {
    const arr = byDay.get(e.dateISO) ?? []
    arr.push(e)
    byDay.set(e.dateISO, arr)
  }

  const daysInMonth = new Date(Date.UTC(vy, vm + 1, 0)).getUTCDate()
  const leading = (new Date(Date.UTC(vy, vm, 1)).getUTCDay() + 6) % 7 // Monday = 0
  const keyFor = (day: number) => `${vy}-${pad(vm + 1)}-${pad(day)}`
  const monthLabel = new Date(Date.UTC(vy, vm, 1)).toLocaleDateString('en', {
    month: 'long', year: 'numeric', timeZone: 'UTC',
  })
  const monthPrefix = `${vy}-${pad(vm + 1)}-`
  const monthCount = events.filter((e) => e.dateISO.startsWith(monthPrefix)).length

  // Detail panel: a tapped day's deadlines, otherwise the chronological list of
  // windows still open (across all months, so a deadline next week is visible
  // without hunting for the right month).
  const upcoming = events
    .filter((e) => e.state !== 'closed' && e.dateISO >= todayISO)
    .sort((a, b) => a.dateISO.localeCompare(b.dateISO))
  const panelEvents = selected ? (byDay.get(selected) ?? []) : upcoming.slice(0, 8)
  const selectedLabel = selected
    ? new Date(selected + 'T00:00:00Z').toLocaleDateString('en', {
        weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC',
      })
    : null

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-display text-2xl">Cancellation calendar</h3>
        <div className="flex items-center gap-2 text-xs text-ink-muted">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-sage" />Open</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gold" />Soon</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-ink-muted/40" />Closed</span>
        </div>
      </div>

      {/* Month switcher */}
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={() => shift(-1)}
          aria-label="Previous month"
          className="p-1.5 rounded-md text-ink-muted hover:text-ink hover:bg-line-soft transition"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="text-sm font-medium text-ink">
          {monthLabel}
          <span className="text-ink-muted font-normal ml-2 text-xs">
            {monthCount > 0 ? `${monthCount} ${monthCount === 1 ? 'deadline' : 'deadlines'}` : 'none this month'}
          </span>
        </div>
        <button
          type="button"
          onClick={() => shift(1)}
          aria-label="Next month"
          className="p-1.5 rounded-md text-ink-muted hover:text-ink hover:bg-line-soft transition"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-xs text-ink-muted mb-2">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <div key={i} className="text-center">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: leading }).map((_, i) => (
          <div key={`blank-${i}`} className="aspect-square rounded-md border border-line/40 bg-paper/30" />
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1
          const key = keyFor(day)
          const dayEvents = byDay.get(key) ?? []
          const has = dayEvents.length > 0
          const isToday = key === todayISO
          const isSel = key === selected
          const state = has ? dominant(dayEvents) : null
          return (
            <button
              key={key}
              type="button"
              disabled={!has}
              onClick={() => setSelected(isSel ? null : key)}
              className={`aspect-square rounded-md p-1.5 text-xs relative text-left transition ${
                state ? CELL[state] : 'border border-line/40'
              } ${isToday ? 'ring-1 ring-ink ring-offset-1 ring-offset-paper-pure' : ''} ${
                isSel ? 'ring-2 ring-ink' : ''
              } ${has ? 'cursor-pointer hover:brightness-95' : ''}`}
            >
              <span className={isToday ? 'font-bold text-ink' : ''}>{day}</span>
              {has && (
                <span className={`absolute bottom-1 right-1 num-mono text-[9px] ${TXT[state!]}`}>
                  {dayEvents.length > 1 ? `•${dayEvents.length}` : dayEvents[0].compactRefund}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Detail / upcoming list */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs text-ink-muted">{selected ? selectedLabel : 'Free-cancel windows still open'}</div>
          {selected && (
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="inline-flex items-center gap-1 text-[11px] text-ink-muted hover:text-ink transition"
            >
              <X className="w-3 h-3" /> Show upcoming
            </button>
          )}
        </div>

        {panelEvents.length === 0 ? (
          <p className="text-sm text-ink-muted italic py-2">
            {selected ? 'No cancellation deadline this day.' : 'No open cancellation windows — set terms on a booking below.'}
          </p>
        ) : (
          <div className="space-y-1">
            {panelEvents.map((e) => (
              <div key={e.id} className="flex items-center gap-3 text-sm p-2 rounded hover:bg-line-soft">
                <span className={`w-2 h-2 rounded-full shrink-0 ${DOT[e.state]}`} />
                <div className="flex-1 min-w-0">
                  <div className="truncate">{e.label}</div>
                  <div className="text-[11px] text-ink-muted truncate">{e.detail}</div>
                </div>
                {!selected && <span className="text-ink-muted text-xs shrink-0 num-mono">{e.dateLabel}</span>}
                <span className={`text-xs shrink-0 ${TXT[e.state]}`}>{e.refundLabel}</span>
              </div>
            ))}
            {!selected && upcoming.length > panelEvents.length && (
              <p className="text-[11px] text-ink-muted pl-2 pt-1">
                +{upcoming.length - panelEvents.length} more — see all terms below.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
