'use client'

import { useState, useTransition } from 'react'
import { Plus, X, MapPinPlus } from 'lucide-react'
import { addVisitedCountry } from '@/lib/actions'

type Option = {
  isoNumeric: string
  label: string
  passportIcon?: string
}

/**
 * Form on /atlas for adding a country the user visited outside Voyage —
 * pre-app trips, or short visits they didn't plan in the app. Picks from
 * the curated destinations list (same one used by trip creation), with
 * optional approximate days + year so the entry can earn a tier on the
 * map even without a full Voyage trip behind it.
 */
export function AddVisitedCountryClient({ options }: { options: Option[] }) {
  const [open, setOpen] = useState(false)
  const [iso, setIso] = useState('')
  const [days, setDays] = useState('')
  const [year, setYear] = useState('')
  const [note, setNote] = useState('')
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const [pending, startTransition] = useTransition()

  function reset() {
    setIso(''); setDays(''); setYear(''); setNote(''); setResult(null)
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setResult(null)
    if (!iso) {
      setResult({ ok: false, msg: 'Pick a country first.' })
      return
    }
    const fd = new FormData()
    fd.set('isoNumeric', iso)
    if (days) fd.set('daysApprox', days)
    if (year) fd.set('yearVisited', year)
    if (note) fd.set('note', note)
    startTransition(async () => {
      const res = await addVisitedCountry(fd)
      if (res.ok) {
        setResult({ ok: true, msg: 'Added — it should now appear on your map.' })
        reset()
        // Auto-collapse after a short delay so the user sees the success
        setTimeout(() => setOpen(false), 1200)
      } else {
        setResult({ ok: false, msg: res.error })
      }
    })
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full border-2 border-dashed border-line rounded-xl bg-paper-pure hover:bg-line-soft/40 px-4 py-4 text-sm text-ink-muted hover:text-ink transition inline-flex items-center justify-center gap-2"
      >
        <MapPinPlus className="w-4 h-4" />
        Add a country I&apos;ve already visited
      </button>
    )
  }

  return (
    <form onSubmit={submit} className="border border-line rounded-xl bg-paper-pure p-4 sm:p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[10px] uppercase tracking-[0.18em] text-ink-muted">Add a visited country</div>
        <button
          type="button"
          onClick={() => { setOpen(false); reset() }}
          className="text-ink-muted hover:text-ink p-1 -mr-1"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block sm:col-span-2">
          <span className="text-[10px] uppercase tracking-[0.18em] text-ink-muted">Country</span>
          <select
            className="input mt-1"
            value={iso}
            onChange={(e) => setIso(e.target.value)}
            required
          >
            <option value="">Pick a country…</option>
            {options.map((o) => (
              <option key={o.isoNumeric} value={o.isoNumeric}>
                {o.passportIcon ? `${o.passportIcon} ` : ''}{o.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-[10px] uppercase tracking-[0.18em] text-ink-muted">Days (approx)</span>
          <input
            type="number"
            min={1}
            className="input mt-1 num-mono"
            value={days}
            onChange={(e) => setDays(e.target.value)}
            placeholder="e.g. 10"
          />
        </label>

        <label className="block">
          <span className="text-[10px] uppercase tracking-[0.18em] text-ink-muted">Year</span>
          <input
            type="number"
            min={1900}
            max={2100}
            className="input mt-1 num-mono"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            placeholder="e.g. 2019"
          />
        </label>

        <label className="block sm:col-span-2">
          <span className="text-[10px] uppercase tracking-[0.18em] text-ink-muted">Note (optional)</span>
          <input
            type="text"
            className="input mt-1"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Honeymoon · Hiking in the Dolomites · whatever you remember"
          />
        </label>
      </div>

      <div className="flex items-center justify-between gap-3 mt-4">
        <p className="text-xs text-ink-muted italic">
          Counts toward your map tier even without a full Voyage trip.
        </p>
        <button
          type="submit"
          disabled={pending || !iso}
          className="btn-ink inline-flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Plus className="w-3.5 h-3.5" />
          {pending ? 'Adding…' : 'Add to atlas'}
        </button>
      </div>

      {result && (
        <div className={`text-xs mt-3 ${result.ok ? 'text-sage-dark' : 'text-rust'}`}>
          {result.ok ? '✓ ' : '× '}{result.msg}
        </div>
      )}
    </form>
  )
}
