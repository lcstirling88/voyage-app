'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { MarkPaidButton } from './MarkPaidButton'

/**
 * One money movement on the payment calendar — a scheduled payment or an unpaid
 * booking. All display strings are pre-formatted server-side so this component
 * ships no currency/FX logic and can't disagree with the rest of the page.
 */
export type MoneyEvent = {
  id: string
  kind: 'booking' | 'payment'
  label: string
  /** YYYY-MM-DD, used for both grid placement and chronological sorting. */
  dateISO: string
  dateLabel: string
  amountLabel: string
  /** Tight form for the calendar cell, e.g. "$1.3k". */
  compactAmount: string
  state: 'paid' | 'auto' | 'action'
  /** What's required / how it pays, e.g. "Pay at venue on arrival". */
  detail: string
  paid: boolean
}

const CELL: Record<MoneyEvent['state'], string> = {
  paid: 'border-2 border-sage bg-sage-soft',
  auto: 'border-2 border-gold bg-gold-soft',
  action: 'border-2 border-rust bg-sakura-soft',
}
const DOT: Record<MoneyEvent['state'], string> = {
  paid: 'bg-sage',
  auto: 'bg-gold',
  action: 'bg-rust',
}
const AMT: Record<MoneyEvent['state'], string> = {
  paid: 'text-sage',
  auto: 'text-gold',
  action: 'text-rust',
}

// Most-urgent state wins when a day stacks several events.
const PRIORITY: Record<MoneyEvent['state'], number> = { action: 2, auto: 1, paid: 0 }
function dominant(events: MoneyEvent[]): MoneyEvent['state'] {
  return events.reduce<MoneyEvent['state']>(
    (acc, e) => (PRIORITY[e.state] > PRIORITY[acc] ? e.state : acc),
    'paid',
  )
}

const pad = (n: number) => String(n).padStart(2, '0')

export function PaymentCalendarClient({
  events,
  todayISO,
  initialYear,
  initialMonth,
  tripSlug,
}: {
  events: MoneyEvent[]
  todayISO: string
  initialYear: number
  initialMonth: number // 0-based
  tripSlug: string
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

  const byDay = new Map<string, MoneyEvent[]>()
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

  // Detail panel: a tapped day's events, otherwise the chronological "still to
  // pay" list (across all months, so tomorrow's payment is visible without
  // hunting for the right month).
  const upcoming = events
    .filter((e) => !e.paid && e.dateISO >= todayISO)
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
        <h3 className="font-display text-2xl">Payment calendar</h3>
        <div className="flex items-center gap-2 text-xs text-ink-muted">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-sage" />Paid</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gold" />Auto</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rust" />Action</span>
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
            {monthCount > 0 ? `${monthCount} ${monthCount === 1 ? 'item' : 'items'}` : 'nothing due'}
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
                <span className={`absolute bottom-1 right-1 num-mono text-[9px] ${AMT[state!]}`}>
                  {dayEvents.length > 1 ? `•${dayEvents.length}` : dayEvents[0].compactAmount}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Detail / upcoming list */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs text-ink-muted">{selected ? selectedLabel : 'Upcoming'}</div>
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
            {selected ? 'Nothing due this day.' : 'Nothing left to pay — you’re all settled.'}
          </p>
        ) : (
          <div className="space-y-1">
            {panelEvents.map((e) => (
              <div key={`${e.kind}-${e.id}`} className="flex items-center gap-3 text-sm p-2 rounded hover:bg-line-soft">
                <span className={`w-2 h-2 rounded-full shrink-0 ${DOT[e.state]}`} />
                <div className="flex-1 min-w-0">
                  <div className="truncate">{e.label}</div>
                  <div className="text-[11px] text-ink-muted truncate">{e.detail}</div>
                </div>
                {!selected && <span className="text-ink-muted text-xs shrink-0 num-mono">{e.dateLabel}</span>}
                <span className={`num-mono shrink-0 ${e.paid ? 'text-ink-muted line-through' : ''}`}>{e.amountLabel}</span>
                <div className="shrink-0">
                  <MarkPaidButton kind={e.kind} id={e.id} tripSlug={tripSlug} paid={e.paid} />
                </div>
              </div>
            ))}
            {!selected && upcoming.length > panelEvents.length && (
              <p className="text-[11px] text-ink-muted pl-2 pt-1">
                +{upcoming.length - panelEvents.length} more — see the full ledger below.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
