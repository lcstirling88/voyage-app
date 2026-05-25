'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles, ArrowRight, Wand2, Plus } from 'lucide-react'
import { addBookingManually, suggestActivities, type Suggestion } from '@/lib/actions'

const TYPE_OPTIONS = [
  { value: 'activity',   label: 'Activity' },
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'transit',    label: 'Transit' },
  { value: 'flight',     label: 'Flight' },
  { value: 'car',        label: 'Car hire' },
  { value: 'hotel',      label: 'Hotel' },
  { value: 'other',      label: 'Other' },
]

const SESSION_DEFAULT_TIME: Record<string, string> = {
  morning:   '09:00',
  afternoon: '13:00',
  night:     '19:00',
}

export function AddBookingPageClient({
  tripSlug, date, session,
}: {
  tripSlug: string
  date: string         // YYYY-MM-DD
  session: string      // morning|afternoon|night|''
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
      <ManualSection tripSlug={tripSlug} date={date} session={session} />
      <AISection tripSlug={tripSlug} date={date} session={session} />
    </div>
  )
}

// =========================================================================
// Manual add
// =========================================================================

function ManualSection({
  tripSlug, date, session,
}: { tripSlug: string; date: string; session: string }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    fd.set('tripSlug', tripSlug)
    fd.set('date', date)
    startTransition(async () => {
      const res = await addBookingManually(fd)
      if (res.ok) router.push(`/trips/${tripSlug}/itinerary`)
      else setError(res.error)
    })
  }

  const defaultTime = session in SESSION_DEFAULT_TIME ? SESSION_DEFAULT_TIME[session] : '09:00'

  return (
    <section className="border border-line rounded-2xl bg-paper-pure p-5 sm:p-6">
      <div className="flex items-center gap-2 mb-1">
        <Plus className="w-4 h-4 text-sage" />
        <h2 className="font-display text-2xl">Add manually</h2>
      </div>
      <p className="text-sm text-ink-muted mb-5">Got it from somewhere already? Type it in.</p>

      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="text-[10px] uppercase tracking-[0.18em] text-ink-muted">Title *</label>
          <input
            name="title"
            required
            autoFocus
            placeholder="e.g. Te Anau Glowworm Cave tour"
            className="input mt-1.5"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] uppercase tracking-[0.18em] text-ink-muted">Time *</label>
            <input name="time" type="time" defaultValue={defaultTime} className="input mt-1.5 num-mono" required />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-[0.18em] text-ink-muted">Type</label>
            <select name="type" defaultValue="activity" className="input mt-1.5">
              {TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="text-[10px] uppercase tracking-[0.18em] text-ink-muted">Location</label>
          <input name="location" placeholder="Address or neighbourhood" className="input mt-1.5" />
        </div>

        <div>
          <label className="text-[10px] uppercase tracking-[0.18em] text-ink-muted">Notes</label>
          <textarea name="notes" placeholder="Anything worth remembering" rows={2} className="input mt-1.5" />
        </div>

        <details className="text-sm">
          <summary className="text-ink-muted cursor-pointer hover:text-ink select-none">
            Multi-day? Set an end date too
          </summary>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase tracking-[0.18em] text-ink-muted">End date</label>
              <input name="endDate" type="date" className="input mt-1.5 num-mono" />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-[0.18em] text-ink-muted">End time</label>
              <input name="endTime" type="time" className="input mt-1.5 num-mono" />
            </div>
          </div>
        </details>

        {error && (
          <div className="border border-rust bg-sakura-soft rounded-lg p-3 text-sm">
            {error}
          </div>
        )}

        <button type="submit" disabled={pending} className="btn-ink w-full justify-center">
          {pending ? 'Adding…' : <>Add to itinerary <ArrowRight className="w-4 h-4" /></>}
        </button>
      </form>
    </section>
  )
}

// =========================================================================
// AI suggestions
// =========================================================================

const SAMPLE_PROMPTS = [
  'A morning hike under 2 hours',
  'A romantic dinner under NZD 200',
  'Something to do with the kids',
  'A relaxing afternoon — no driving',
]

function AISection({
  tripSlug, date, session,
}: { tripSlug: string; date: string; session: string }) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [askingPending, startAskTransition] = useTransition()
  const [addingPending, startAddTransition] = useTransition()

  function ask(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSuggestions(null)
    const fd = new FormData()
    fd.set('tripSlug', tripSlug)
    fd.set('date', date)
    fd.set('session', session)
    fd.set('query', query)
    startAskTransition(async () => {
      const res = await suggestActivities(fd)
      if (res.ok) setSuggestions(res.suggestions)
      else setError(res.error)
    })
  }

  function addSuggestion(s: Suggestion) {
    const fd = new FormData()
    fd.set('tripSlug', tripSlug)
    fd.set('date', date)
    fd.set('title', s.title)
    fd.set('time', s.time)
    fd.set('type', s.type)
    if (s.location) fd.set('location', s.location)
    if (s.notes) fd.set('notes', s.notes)
    startAddTransition(async () => {
      const res = await addBookingManually(fd)
      if (res.ok) router.push(`/trips/${tripSlug}/itinerary`)
      else setError(res.error)
    })
  }

  return (
    <section className="border border-line rounded-2xl bg-sage text-paper-pure p-5 sm:p-6 relative overflow-hidden">
      <div className="absolute -right-10 -top-10 w-32 h-32 rounded-full bg-sakura/15" />
      <div className="relative">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="w-4 h-4 text-sakura" />
          <h2 className="font-display text-2xl">Ask AI for ideas</h2>
        </div>
        <p className="text-sm text-paper-pure/70 mb-5">
          Voyage knows your trip context. Just say what you&apos;re after.
        </p>

        <form onSubmit={ask} className="space-y-3">
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. a morning hike under 2 hours near Queenstown"
            rows={2}
            required
            className="input bg-paper-pure/10 text-paper-pure placeholder:text-paper-pure/50 border-paper-pure/20 focus:border-sakura"
          />
          <div className="flex flex-wrap gap-2">
            {SAMPLE_PROMPTS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setQuery(p)}
                className="text-[11px] px-3 py-1 rounded-full border border-paper-pure/20 text-paper-pure/80 hover:border-sakura hover:text-sakura transition"
              >
                {p}
              </button>
            ))}
          </div>
          <button
            type="submit"
            disabled={askingPending || !query.trim()}
            className="px-4 py-2 rounded-md bg-paper-pure text-ink hover:opacity-90 text-sm font-medium inline-flex items-center gap-2 disabled:opacity-50"
          >
            <Wand2 className="w-3.5 h-3.5" />
            {askingPending ? 'Thinking…' : 'Get ideas'}
          </button>
        </form>

        {error && (
          <div className="mt-4 border border-sakura bg-sakura/15 rounded-lg p-3 text-sm">{error}</div>
        )}

        {suggestions && suggestions.length === 0 && (
          <div className="mt-4 text-sm text-paper-pure/70 italic">
            No suggestions came back. Try a different prompt.
          </div>
        )}

        {suggestions && suggestions.length > 0 && (
          <div className="mt-5 space-y-3">
            {suggestions.map((s, i) => (
              <article key={i} className="bg-paper-pure text-ink rounded-lg p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="num-mono text-xs text-ink-muted">{s.time}</span>
                      <span className="pill pill-info text-[9px]">{s.type}</span>
                    </div>
                    <h3 className="font-display text-lg mt-1">{s.title}</h3>
                    {s.location && <p className="text-xs text-ink-muted mt-0.5">{s.location}</p>}
                    <p className="text-sm mt-2">{s.notes}</p>
                    {s.estimatedCost != null && (
                      <p className="text-xs num-mono text-ink-muted mt-1">
                        ~{s.estimatedCurrency ?? ''} {s.estimatedCost}{s.durationMinutes ? ` · ${s.durationMinutes}min` : ''}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => addSuggestion(s)}
                    disabled={addingPending}
                    className="btn-ink text-xs shrink-0"
                  >
                    {addingPending ? '…' : <>Add <Plus className="w-3 h-3" /></>}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
