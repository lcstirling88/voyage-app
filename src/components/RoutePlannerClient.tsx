'use client'

/**
 * Route planner — Step 1 of "Let Itinera plan it".
 *
 * The traveller drafts the BACKBONE of the trip before any booking exists:
 * which cities to base in, in what order, for how many nights. Itinera can
 * propose a sensible route ("Generate"), or they can build/edit it by hand
 * (add a city, reorder, nights stepper). Date windows are previewed live via
 * the pure `allocate()` helper — the last stop always absorbs the remainder so
 * the route lands exactly on the trip's end date.
 *
 * Persists through saveTripSkeleton / generateTripSkeleton (City rows). Then
 * "fill the days" hands off to /plan/days (the preferences step).
 */

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Sparkles, Loader2, Plus, X, ChevronUp, ChevronDown, ArrowRight, MapPin, Check,
} from 'lucide-react'
import { format } from 'date-fns'
import { allocate, tripNights, type RouteStop } from '@/lib/skeleton'
import { generateTripSkeleton, saveTripSkeleton, type RouteStopDTO } from '@/lib/actions'

type EditStop = { city: string; country: string; nights: number; note: string | null }

/** Parse a 'yyyy-MM-dd' (or full ISO) string into a LOCAL midnight Date. */
function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

export function RoutePlannerClient({
  tripSlug, destination, startDateISO, endDateISO, initialStops,
}: {
  tripSlug: string
  destination: string
  startDateISO: string
  endDateISO: string
  initialStops: RouteStopDTO[]
}) {
  const router = useRouter()
  const start = useMemo(() => parseLocalDate(startDateISO), [startDateISO])
  const end = useMemo(() => parseLocalDate(endDateISO), [endDateISO])
  const totalNights = useMemo(() => tripNights(start, end), [start, end])

  const [stops, setStops] = useState<EditStop[]>(
    initialStops.map((s) => ({ city: s.city, country: s.country, nights: s.nights, note: s.note })),
  )
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [genPending, startGen] = useTransition()
  const [savePending, startSave] = useTransition()

  // Live date windows. allocate() drops stops that don't fit and lands the last
  // one on the end date, so this is exactly what would be persisted.
  const placed = useMemo(
    () => allocate(stops.map((s) => ({ ...s }) as RouteStop), start, end),
    [stops, start, end],
  )
  const allocatedNights = placed.reduce((sum, s) => sum + s.nights, 0)
  const hasRoute = stops.some((s) => s.city.trim())

  function mutate(next: EditStop[]) {
    setStops(next)
    setSaved(false)
    setError(null)
  }
  const setCity = (i: number, city: string) => mutate(stops.map((s, j) => (j === i ? { ...s, city } : s)))
  const bumpNights = (i: number, delta: number) =>
    mutate(stops.map((s, j) => (j === i ? { ...s, nights: Math.max(1, s.nights + delta) } : s)))
  const remove = (i: number) => mutate(stops.filter((_, j) => j !== i))
  const addCity = () => mutate([...stops, { city: '', country: destination, nights: 2, note: null }])
  function move(i: number, dir: -1 | 1) {
    const j = i + dir
    if (j < 0 || j >= stops.length) return
    const next = [...stops]
    ;[next[i], next[j]] = [next[j], next[i]]
    mutate(next)
  }

  function generate() {
    setError(null)
    const fd = new FormData()
    fd.set('tripSlug', tripSlug)
    // Cities already typed become "must include"; notes steer the rest.
    fd.set('mustInclude', stops.map((s) => s.city.trim()).filter(Boolean).join(', '))
    fd.set('notes', notes.trim())
    startGen(async () => {
      const res = await generateTripSkeleton(fd)
      if (res.ok) {
        setStops(res.stops.map((s) => ({ city: s.city, country: s.country, nights: s.nights, note: s.note })))
        setSaved(true)
        router.refresh()
      } else {
        setError(res.error)
      }
    })
  }

  function save() {
    setError(null)
    const clean = stops
      .map((s) => ({ ...s, city: s.city.trim() }))
      .filter((s) => s.city)
    const fd = new FormData()
    fd.set('tripSlug', tripSlug)
    fd.set('stops', JSON.stringify(clean))
    startSave(async () => {
      const res = await saveTripSkeleton(fd)
      if (res.ok) {
        setStops(res.stops.map((s) => ({ city: s.city, country: s.country, nights: s.nights, note: s.note })))
        setSaved(true)
        router.refresh()
      } else {
        setError(res.error)
      }
    })
  }

  const multiCountry = useMemo(
    () => new Set(stops.map((s) => s.country.trim().toLowerCase()).filter(Boolean)).size > 1,
    [stops],
  )

  return (
    <div className="mt-8 sm:mt-10">
      {/* Generate panel */}
      <div className="rounded-2xl border border-dashed border-sage/50 bg-sage-soft/30 p-4 sm:p-5">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-sage-dark">
          <Sparkles className="w-3.5 h-3.5" /> Let Itinera draft the route
        </div>
        <p className="text-sm text-ink-muted mt-1.5">
          We&rsquo;ll propose which cities to base in and for how many nights, summing to your{' '}
          <span className="num-mono">{totalNights}</span> nights. Anything below is just a steer — edit freely after.
        </p>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="input mt-3 resize-none"
          placeholder="Optional: beaches, no long drives, must see Mt Fuji, slower pace with kids…"
        />
        <button
          type="button"
          onClick={generate}
          disabled={genPending}
          className="btn-ink inline-flex items-center gap-2 mt-3 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {genPending ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Itinera is routing…</>
          ) : (
            <><Sparkles className="w-4 h-4" /> {hasRoute ? 'Re-draft the route' : 'Generate a route'}</>
          )}
        </button>
        {hasRoute && (
          <span className="text-xs text-ink-muted ml-3">Keeps your cities as must-includes.</span>
        )}
      </div>

      {/* Editable stops */}
      <div className="mt-7">
        <div className="flex items-baseline justify-between gap-3 mb-3">
          <div className="text-[10px] uppercase tracking-[0.2em] text-ink-muted">Your route</div>
          <div className="text-xs text-ink-muted">
            <span className={`num-mono ${allocatedNights === totalNights ? 'text-sage-dark' : 'text-rust'}`}>
              {allocatedNights}
            </span>{' '}
            of <span className="num-mono">{totalNights}</span> nights
            {placed.length > 0 && <> · ends {format(placed[placed.length - 1].leaveOn, 'EEE d MMM')}</>}
          </div>
        </div>

        {stops.length === 0 ? (
          <div className="rounded-xl border border-line bg-paper-pure px-4 py-8 text-center text-sm text-ink-muted">
            No cities yet. Generate a route above, or add your first city below.
          </div>
        ) : (
          <ol className="space-y-2.5">
            {stops.map((s, i) => {
              const p = placed.find((x, idx) => idx === i)
              return (
                <li key={i} className="rounded-xl border border-line bg-paper-pure p-3 sm:p-3.5">
                  <div className="flex items-center gap-2.5">
                    {/* Reorder */}
                    <div className="flex flex-col">
                      <button
                        type="button"
                        onClick={() => move(i, -1)}
                        disabled={i === 0}
                        aria-label="Move up"
                        className="text-ink-muted hover:text-ink disabled:opacity-25 disabled:cursor-not-allowed"
                      >
                        <ChevronUp className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => move(i, 1)}
                        disabled={i === stops.length - 1}
                        aria-label="Move down"
                        className="text-ink-muted hover:text-ink disabled:opacity-25 disabled:cursor-not-allowed"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                    </div>

                    <span className="num-mono text-xs text-ink-muted/70 w-4 text-center shrink-0">{i + 1}</span>

                    {/* City */}
                    <div className="flex-1 min-w-0">
                      <input
                        value={s.city}
                        onChange={(e) => setCity(i, e.target.value)}
                        placeholder="City or town to base in"
                        className="w-full bg-transparent border-0 border-b border-transparent hover:border-line focus:border-sage focus:outline-none text-base font-medium py-0.5 transition"
                      />
                    </div>

                    {/* Nights stepper */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => bumpNights(i, -1)}
                        disabled={s.nights <= 1}
                        aria-label="Fewer nights"
                        className="w-7 h-7 rounded-full border border-line grid place-items-center text-ink-muted hover:border-sage hover:text-ink disabled:opacity-30 disabled:cursor-not-allowed transition"
                      >
                        <span className="text-base leading-none">−</span>
                      </button>
                      <span className="num-mono text-sm w-12 text-center tabular-nums">
                        {s.nights} <span className="text-ink-muted/60 text-[10px]">{s.nights === 1 ? 'nt' : 'nts'}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => bumpNights(i, 1)}
                        aria-label="More nights"
                        className="w-7 h-7 rounded-full border border-line grid place-items-center text-ink-muted hover:border-sage hover:text-ink transition"
                      >
                        <span className="text-base leading-none">+</span>
                      </button>
                    </div>

                    {/* Remove */}
                    <button
                      type="button"
                      onClick={() => remove(i)}
                      aria-label="Remove city"
                      className="w-7 h-7 rounded-full grid place-items-center text-ink-muted/60 hover:text-rust hover:bg-rust/5 transition shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Date window + why */}
                  <div className="pl-[3.6rem] pr-1 mt-1 space-y-0.5">
                    {p ? (
                      <div className="text-[11px] uppercase tracking-[0.14em] text-ink-muted/70 flex items-center gap-1.5">
                        <MapPin className="w-3 h-3" />
                        {format(p.arriveOn, 'EEE d MMM')} → {format(p.leaveOn, 'EEE d MMM')}
                        {multiCountry && s.country.trim() && (
                          <span className="text-ink-muted/50">· {s.country}</span>
                        )}
                      </div>
                    ) : (
                      <div className="text-[11px] uppercase tracking-[0.14em] text-rust/70">
                        No nights left — trim an earlier stop
                      </div>
                    )}
                    {s.note && <div className="text-xs text-ink-muted italic">{s.note}</div>}
                  </div>
                </li>
              )
            })}
          </ol>
        )}

        <button
          type="button"
          onClick={addCity}
          className="mt-3 inline-flex items-center gap-2 text-sm text-ink-soft hover:text-ink ulink"
        >
          <Plus className="w-4 h-4" /> Add a city
        </button>
      </div>

      {error && <div className="text-sm text-rust mt-5">{error}</div>}

      {/* Actions */}
      <div className="mt-7 flex flex-wrap items-center gap-3 border-t border-line-soft pt-5">
        <button
          type="button"
          onClick={save}
          disabled={savePending || !hasRoute}
          className="btn-ink inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {savePending ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
          ) : saved ? (
            <><Check className="w-4 h-4" /> Route saved</>
          ) : (
            <>Save route</>
          )}
        </button>

        {hasRoute && (
          <Link
            href={`/trips/${tripSlug}/plan/days`}
            className="group inline-flex items-center gap-2 text-sm font-medium text-sage-dark hover:text-ink transition"
          >
            Next: fill the days
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition" />
          </Link>
        )}
      </div>

      <p className="text-xs text-ink-muted/70 italic mt-4">
        Your route is the backbone — it colours your calendar and tells Itinera where you are each day, even before
        anything&rsquo;s booked. Nothing here is final; come back and reshape it anytime.
      </p>
    </div>
  )
}
