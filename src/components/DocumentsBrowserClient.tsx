'use client'

import { useState, useMemo } from 'react'
import {
  Plane, BedDouble, Car, Train, Ticket, Utensils, ShieldCheck, Stamp,
  FileText, Bed, ExternalLink, Paperclip, MapPin,
} from 'lucide-react'

/**
 * The Documents browser.
 *
 * The server page assembles a flat, already-deduplicated list of DocItems
 * (one downloadable file OR one email-backed confirmation OR one parsed
 * document — never two for the same thing). This component groups them by
 * type, sorts each group by date, and lets the user condense the view to a
 * single city.
 */
export type DocType =
  | 'flight' | 'hotel' | 'car' | 'transit' | 'activity' | 'dining'
  | 'insurance' | 'visa' | 'passport' | 'ticket' | 'voucher' | 'other'

export type DocItem = {
  key: string
  type: DocType
  title: string
  subtitle?: string
  /** Booking date in epoch ms for sorting; null sorts last. */
  dateMs: number | null
  /** Pre-formatted date label (computed server-side), or null. */
  dateLabel: string | null
  city: string | null
  /** Downloadable attachment id → /api/attachments/{fileId}. */
  fileId?: string
  /** Internal link (e.g. the source email detail page). */
  href?: string
}

const TYPE_META: Record<DocType, { label: string; Icon: typeof FileText }> = {
  flight:    { label: 'Flights',          Icon: Plane },
  hotel:     { label: 'Hotels',           Icon: BedDouble },
  car:       { label: 'Car rental',       Icon: Car },
  transit:   { label: 'Transit',          Icon: Train },
  activity:  { label: 'Activities',       Icon: Ticket },
  dining:    { label: 'Dining',           Icon: Utensils },
  insurance: { label: 'Insurance',        Icon: ShieldCheck },
  visa:      { label: 'Visas & entry',    Icon: Stamp },
  passport:  { label: 'Travel documents', Icon: FileText },
  ticket:    { label: 'Tickets',          Icon: Ticket },
  voucher:   { label: 'Vouchers',         Icon: Bed },
  other:     { label: 'Other',            Icon: FileText },
}

// Display order of groups; empty ones are skipped.
const TYPE_ORDER: DocType[] = [
  'flight', 'hotel', 'car', 'transit', 'activity', 'dining',
  'insurance', 'visa', 'passport', 'ticket', 'voucher', 'other',
]

export function DocumentsBrowserClient({ items, cities }: { items: DocItem[]; cities: string[] }) {
  const [city, setCity] = useState<string | null>(null) // null = All

  const visible = useMemo(
    () => (city ? items.filter((i) => i.city === city) : items),
    [items, city],
  )

  const groups = useMemo(() => {
    const byType = new Map<DocType, DocItem[]>()
    for (const it of visible) {
      const arr = byType.get(it.type) ?? []
      arr.push(it)
      byType.set(it.type, arr)
    }
    for (const arr of byType.values()) {
      arr.sort((a, b) => {
        if (a.dateMs == null && b.dateMs == null) return a.title.localeCompare(b.title)
        if (a.dateMs == null) return 1
        if (b.dateMs == null) return -1
        return a.dateMs - b.dateMs
      })
    }
    return TYPE_ORDER
      .map((t) => ({ type: t, list: byType.get(t) ?? [] }))
      .filter((g) => g.list.length > 0)
  }, [visible])

  if (items.length === 0) {
    return (
      <div className="border border-dashed border-line rounded-xl p-10 text-center text-ink-muted">
        <Paperclip className="w-6 h-6 mx-auto mb-3 opacity-50" />
        <p className="text-sm">
          No documents yet. Forward a booking confirmation to your trip inbox and it lands here —
          tickets, vouchers and confirmations, sorted automatically.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-8 sm:space-y-10">
      {/* City filter — condenses the page to one place at a time. */}
      {cities.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] uppercase tracking-[0.18em] text-ink-muted mr-1 inline-flex items-center gap-1">
            <MapPin className="w-3 h-3" /> Filter
          </span>
          <FilterChip label="All" active={city === null} onClick={() => setCity(null)} />
          {cities.map((c) => (
            <FilterChip key={c} label={c} active={city === c} onClick={() => setCity(c)} />
          ))}
        </div>
      )}

      {groups.length === 0 ? (
        <div className="text-sm text-ink-muted italic">No documents for {city}.</div>
      ) : (
        groups.map(({ type, list }) => {
          const { label, Icon } = TYPE_META[type]
          return (
            <section key={type}>
              <div className="flex items-baseline justify-between mb-3">
                <h2 className="font-display text-2xl flex items-center gap-2">
                  <Icon className="w-5 h-5 text-sage" /> {label}
                </h2>
                <span className="text-xs text-ink-muted">{list.length}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {list.map((it) => (
                  <DocRow key={it.key} item={it} />
                ))}
              </div>
            </section>
          )
        })
      )}
    </div>
  )
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`text-xs px-3 py-1 rounded-full border transition ${
        active
          ? 'bg-ink text-paper-pure border-ink'
          : 'border-line text-ink-muted hover:text-ink hover:border-ink-muted'
      }`}
    >
      {label}
    </button>
  )
}

function DocRow({ item }: { item: DocItem }) {
  const { Icon } = TYPE_META[item.type]
  const meta = [item.dateLabel, item.city, item.subtitle].filter(Boolean).join(' · ')
  const inner = (
    <>
      <div className="w-11 h-11 rounded-lg bg-sage-soft grid place-items-center shrink-0">
        <Icon className="w-5 h-5 text-sage" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-display text-sm leading-tight truncate">{item.title}</div>
        {meta && <div className="text-[10px] text-ink-muted num-mono mt-0.5 truncate">{meta}</div>}
      </div>
      {(item.fileId || item.href) && (
        <ExternalLink className="w-3.5 h-3.5 text-ink-muted/50 group-hover:text-sage shrink-0" />
      )}
    </>
  )
  const base =
    'group border border-line rounded-xl bg-paper-pure p-4 transition flex items-center gap-3'

  if (item.fileId) {
    return (
      <a
        href={`/api/attachments/${item.fileId}`}
        target="_blank"
        rel="noopener noreferrer"
        className={`${base} hover:border-sage hover:shadow-soft`}
      >
        {inner}
      </a>
    )
  }
  if (item.href) {
    return (
      <a href={item.href} className={`${base} hover:border-sage hover:shadow-soft`}>
        {inner}
      </a>
    )
  }
  return <div className={base}>{inner}</div>
}
