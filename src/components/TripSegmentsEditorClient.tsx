'use client'

import { useState, useTransition } from 'react'
import { MapPin, Plus, X } from 'lucide-react'
import { addTripSegment, deleteTripSegment } from '@/lib/actions'

type SegmentRow = { id: string; country: string; flag: string | null; range: string }
type CountryOption = { isoNumeric: string; label: string; flag: string | null }

/**
 * Settings editor for a trip's country legs. Each leg is a country + date
 * window; the app uses them to adapt the clock/weather/currency to where you
 * are and to aggregate visa/local-info across all countries. A trip with no
 * legs behaves as a single implicit leg from its destination, so this is
 * optional — only multi-country trips need it.
 */
export function TripSegmentsEditorClient({
  tripSlug,
  segments,
  options,
  tripStart,
  tripEnd,
}: {
  tripSlug: string
  segments: SegmentRow[]
  options: CountryOption[]
  tripStart: string
  tripEnd: string
}) {
  const [iso, setIso] = useState('')
  const [start, setStart] = useState(tripStart)
  const [end, setEnd] = useState(tripEnd)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function add() {
    setError(null)
    if (!iso) { setError('Pick a country.'); return }
    const fd = new FormData()
    fd.set('tripSlug', tripSlug)
    fd.set('isoNumeric', iso)
    fd.set('startDate', start)
    fd.set('endDate', end)
    startTransition(async () => {
      const res = await addTripSegment(fd)
      if (!res.ok) setError(res.error)
      else setIso('')
    })
  }

  function remove(id: string) {
    const fd = new FormData()
    fd.set('tripSlug', tripSlug)
    fd.set('id', id)
    startTransition(async () => { await deleteTripSegment(fd) })
  }

  return (
    <div className="space-y-4">
      {segments.length > 0 ? (
        <ul className="space-y-2">
          {segments.map((s) => (
            <li key={s.id} className="flex items-center gap-3 border border-line rounded-lg bg-paper-pure px-4 py-3">
              <span className="text-lg shrink-0" aria-hidden>{s.flag ?? '📍'}</span>
              <div className="min-w-0 flex-1">
                <div className="font-display text-base leading-tight">{s.country}</div>
                <div className="text-xs text-ink-muted num-mono">{s.range}</div>
              </div>
              <button
                type="button"
                onClick={() => remove(s.id)}
                disabled={pending}
                className="text-ink-muted hover:text-rust p-1 disabled:opacity-40"
                aria-label={`Remove ${s.country}`}
              >
                <X className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink-muted italic">
          No legs added — this trip is treated as a single country from its destination.
          Add legs below if it spans more than one country.
        </p>
      )}

      {/* Add a leg */}
      <div className="border border-dashed border-line rounded-lg p-4 space-y-3">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-ink-muted">
          <MapPin className="w-3 h-3" /> Add a country leg
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2 sm:items-end">
          <label className="block">
            <span className="text-[10px] uppercase tracking-[0.18em] text-ink-muted">Country</span>
            <select className="input mt-1" value={iso} onChange={(e) => setIso(e.target.value)} disabled={pending}>
              <option value="">Select…</option>
              {options.map((o) => (
                <option key={o.isoNumeric} value={o.isoNumeric}>
                  {o.flag ? `${o.flag} ` : ''}{o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-[10px] uppercase tracking-[0.18em] text-ink-muted">From</span>
            <input type="date" className="input mt-1" value={start} min={tripStart} max={tripEnd} onChange={(e) => setStart(e.target.value)} disabled={pending} />
          </label>
          <label className="block">
            <span className="text-[10px] uppercase tracking-[0.18em] text-ink-muted">To</span>
            <input type="date" className="input mt-1" value={end} min={tripStart} max={tripEnd} onChange={(e) => setEnd(e.target.value)} disabled={pending} />
          </label>
        </div>
        {error && <div className="text-xs text-rust">{error}</div>}
        <button type="button" onClick={add} disabled={pending} className="btn-ink text-sm disabled:opacity-50">
          <Plus className="w-4 h-4" /> {pending ? 'Saving…' : 'Add leg'}
        </button>
      </div>
    </div>
  )
}
