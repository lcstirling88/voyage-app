'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Plus, Sparkles, X } from 'lucide-react'
import { addBookingManually } from '@/lib/actions'
import type { Session } from '@/lib/itinerary'
import { SESSION_DEFAULT_HOUR } from '@/lib/itinerary'
import { format } from 'date-fns'

const TYPE_OPTIONS = [
  { value: 'activity',   label: 'Activity' },
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'transit',    label: 'Transit' },
  { value: 'flight',     label: 'Flight' },
  { value: 'car',        label: 'Car hire' },
  { value: 'other',      label: 'Other' },
]

export function AddSessionItemClient({
  tripSlug,
  day,
  session,
}: {
  tripSlug: string
  day: string        // ISO date 'YYYY-MM-DD'
  session: Session
}) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const defaultTime = `${String(SESSION_DEFAULT_HOUR[session]).padStart(2, '0')}:00`

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    fd.set('tripSlug', tripSlug)
    fd.set('date', day)
    startTransition(async () => {
      const res = await addBookingManually(fd)
      if (res.ok) {
        setOpen(false)
      } else {
        setError(res.error)
      }
    })
  }

  if (!open) {
    return (
      <div className="flex gap-2 items-center">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-xs px-3 py-2 border border-dashed border-line rounded-md text-ink-muted hover:border-sage hover:text-sage transition flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" /> Add to {session}
        </button>
        <Link
          href={`/trips/${tripSlug}/assistant?context=${encodeURIComponent(`${day} ${session}`)}`}
          className="text-xs px-3 py-2 rounded-md text-ink-muted hover:bg-line-soft transition flex items-center gap-1.5"
        >
          <Sparkles className="w-3.5 h-3.5 text-sage" /> Ask AI for ideas
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="border border-line rounded-lg bg-paper-pure p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-[0.18em] text-ink-muted">
          Add to {session} · {day}
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-ink-muted hover:text-ink p-1"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <input
        name="title"
        autoFocus
        required
        placeholder="What is it? (e.g. Te Anau Glowworm Cave tour)"
        className="input"
      />

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] uppercase tracking-[0.18em] text-ink-muted">Time</label>
          <input name="time" type="time" defaultValue={defaultTime} className="input mt-1 num-mono" />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-[0.18em] text-ink-muted">Type</label>
          <select name="type" defaultValue="activity" className="input mt-1">
            {TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      <details className="text-xs">
        <summary className="text-ink-muted cursor-pointer hover:text-ink">More options (location, end time, notes)</summary>
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase tracking-[0.18em] text-ink-muted">End date (optional)</label>
              <input name="endDate" type="date" defaultValue="" className="input mt-1 num-mono" />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-[0.18em] text-ink-muted">End time</label>
              <input name="endTime" type="time" defaultValue="" className="input mt-1 num-mono" />
            </div>
          </div>
          <input name="location" placeholder="Location (city or address)" className="input" />
          <textarea name="notes" placeholder="Notes" rows={2} className="input" />
        </div>
      </details>

      {error && <div className="text-xs text-rust">{error}</div>}

      <div className="flex items-center justify-end gap-2">
        <button type="button" onClick={() => setOpen(false)} className="btn-ghost text-xs">Cancel</button>
        <button type="submit" disabled={pending} className="btn-ink text-xs">
          {pending ? 'Adding…' : 'Add to itinerary'}
        </button>
      </div>
    </form>
  )
}
