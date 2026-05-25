'use client'

import { useState, useTransition, useEffect } from 'react'
import { ArrowRight, Trash2, AlertTriangle } from 'lucide-react'
import { editTrip, deleteTrip, type EditTripResult } from '@/lib/actions'
import { deriveThemeFromDestination, themes, themeOptions, type ThemeKey } from '@/lib/theme'

const DEFAULT_CURRENCIES = ['AUD', 'USD', 'GBP', 'EUR', 'NZD', 'JPY', 'SGD']

function PaletteOption({
  value, current, onPick, label, sample,
}: {
  value: string
  current: string
  onPick: (v: string) => void
  label: string
  sample: string[]
}) {
  const active = current === value
  return (
    <button
      type="button"
      onClick={() => onPick(value)}
      className={`text-left rounded-lg border p-3 transition ${active ? 'border-ink shadow-soft' : 'border-line hover:border-ink-muted'}`}
    >
      <div className="flex gap-1 mb-2">
        {sample.map((c, i) => (
          <span key={i} className="h-3 flex-1 rounded-sm" style={{ background: c }} />
        ))}
      </div>
      <div className="text-xs font-medium">{label}</div>
    </button>
  )
}

type TripData = {
  id: string
  name: string
  tagline: string | null
  destination: string
  themeKey: string
  startDate: string  // YYYY-MM-DD
  endDate: string    // YYYY-MM-DD
  homeCurrency: string
  travelerNames: string | null
  departureCity: string | null
  adultCount: number
  childCount: number
  childrenAges: string | null
  colorPalette: string
  inboxToken: string
  bookingsCount: number
  documentsCount: number
}

export function EditTripFormClient({ trip }: { trip: TripData }) {
  const [name, setName] = useState(trip.name)
  const [tagline, setTagline] = useState(trip.tagline ?? '')
  const [destination, setDestination] = useState(trip.destination)
  const [startDate, setStartDate] = useState(trip.startDate)
  const [endDate, setEndDate] = useState(trip.endDate)
  const [homeCurrency, setHomeCurrency] = useState(trip.homeCurrency)
  const [travelerNames, setTravelerNames] = useState(trip.travelerNames ?? '')
  const [departureCity, setDepartureCity] = useState(trip.departureCity ?? '')
  const [themeKey, setThemeKey] = useState<ThemeKey>(trip.themeKey as ThemeKey)
  const [themeOverridden, setThemeOverridden] = useState(true) // already set
  const [adultCount, setAdultCount] = useState(trip.adultCount ?? 1)
  const [childCount, setChildCount] = useState(trip.childCount ?? 0)
  const [childrenAges, setChildrenAges] = useState(trip.childrenAges ?? '')
  const [colorPalette, setColorPalette] = useState(trip.colorPalette || 'pastel')
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [pending, startTransition] = useTransition()

  const [confirmText, setConfirmText] = useState('')
  const [deletePending, startDeleteTransition] = useTransition()

  useEffect(() => {
    if (!themeOverridden) setThemeKey(deriveThemeFromDestination(destination))
  }, [destination, themeOverridden])

  const previewTheme = themes[themeKey]

  function save(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaved(false)
    const fd = new FormData()
    fd.set('id', trip.id)
    fd.set('name', name)
    fd.set('tagline', tagline)
    fd.set('destination', destination)
    fd.set('startDate', startDate)
    fd.set('endDate', endDate)
    fd.set('homeCurrency', homeCurrency)
    fd.set('travelerNames', travelerNames)
    fd.set('departureCity', departureCity)
    fd.set('themeKey', themeKey)
    fd.set('adultCount', String(adultCount))
    fd.set('childCount', String(childCount))
    fd.set('childrenAges', childrenAges)
    fd.set('colorPalette', colorPalette)
    startTransition(async () => {
      const res = (await editTrip(fd)) as EditTripResult
      if (res.ok === false) setError(res.error)
      else { setSaved(true); setTimeout(() => setSaved(false), 3000) }
    })
  }

  function performDelete() {
    const fd = new FormData()
    fd.set('id', trip.id)
    startDeleteTransition(async () => {
      // Server action redirects → no need to handle response
      await deleteTrip(fd)
    })
  }

  return (
    <div className="space-y-12">
      <form onSubmit={save} className="space-y-8">
        <div
          className="relative overflow-hidden rounded-2xl h-44 border border-line"
          style={{ background: previewTheme.heroGradient }}
        >
          {previewTheme.heroPattern === 'asanoha' && <div className="pattern-asanoha absolute inset-0 opacity-30" />}
          <div className="relative p-7">
            <div className="text-paper-pure/70 text-[10px] uppercase tracking-[0.25em] mb-3">
              {previewTheme.motif && <span className="mr-2">{previewTheme.motif}</span>}
              {previewTheme.scriptLine ?? destination}
            </div>
            <div className="h-display text-paper-pure text-5xl truncate">{name || 'Your trip'}</div>
            {tagline && <div className="font-display italic text-paper-pure/70 text-sm mt-2 max-w-md truncate">{tagline}</div>}
          </div>
        </div>

        <section className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
          <div className="col-span-2">
            <label className="text-[10px] uppercase tracking-[0.2em] text-ink-muted">Trip name *</label>
            <input className="input mt-1.5 text-2xl font-display" value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} />
          </div>
          <div className="col-span-2">
            <label className="text-[10px] uppercase tracking-[0.2em] text-ink-muted">Tagline</label>
            <input className="input mt-1.5" value={tagline} onChange={(e) => setTagline(e.target.value)} maxLength={140} />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-[0.2em] text-ink-muted">Destination *</label>
            <input className="input mt-1.5" value={destination} onChange={(e) => setDestination(e.target.value)} required />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-[0.2em] text-ink-muted">Departure city</label>
            <input className="input mt-1.5" value={departureCity} onChange={(e) => setDepartureCity(e.target.value)} />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-[0.2em] text-ink-muted">Start date *</label>
            <input className="input mt-1.5 num-mono" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-[0.2em] text-ink-muted">End date *</label>
            <input className="input mt-1.5 num-mono" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-[0.2em] text-ink-muted">Home currency</label>
            <select className="input mt-1.5" value={homeCurrency} onChange={(e) => setHomeCurrency(e.target.value)}>
              {DEFAULT_CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-[0.2em] text-ink-muted">Theme</label>
            <select className="input mt-1.5" value={themeKey} onChange={(e) => { setThemeKey(e.target.value as ThemeKey); setThemeOverridden(true) }}>
              {themeOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className="text-[10px] uppercase tracking-[0.2em] text-ink-muted">Travellers</label>
            <input className="input mt-1.5" value={travelerNames} onChange={(e) => setTravelerNames(e.target.value)} />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-[0.2em] text-ink-muted">Adults</label>
            <input className="input mt-1.5 num-mono" type="number" min={0} max={20} value={adultCount} onChange={(e) => setAdultCount(Math.max(0, parseInt(e.target.value, 10) || 0))} />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-[0.2em] text-ink-muted">Children</label>
            <input className="input mt-1.5 num-mono" type="number" min={0} max={20} value={childCount} onChange={(e) => setChildCount(Math.max(0, parseInt(e.target.value, 10) || 0))} />
          </div>
          {childCount > 0 && (
            <div className="col-span-2">
              <label className="text-[10px] uppercase tracking-[0.2em] text-ink-muted">Children&apos;s ages</label>
              <input className="input mt-1.5" value={childrenAges} onChange={(e) => setChildrenAges(e.target.value)} placeholder="e.g. 8, 11" />
            </div>
          )}
          <div className="col-span-2">
            <label className="text-[10px] uppercase tracking-[0.2em] text-ink-muted">Accommodation colour scheme</label>
            <div className="grid grid-cols-3 gap-2 mt-1.5">
              <PaletteOption value="pastel" current={colorPalette} onPick={setColorPalette}
                label="Pastel" sample={['#E8C9C9', '#CBDCE8', '#CFE5D2', '#E8DFC4']} />
              <PaletteOption value="jewel" current={colorPalette} onPick={setColorPalette}
                label="Jewel" sample={['#2E5A47', '#2A4A72', '#7A2E3A', '#503279']} />
              <PaletteOption value="mono" current={colorPalette} onPick={setColorPalette}
                label="Mono" sample={['#3F5B4E', '#3F5B4E', '#3F5B4E', '#3F5B4E']} />
            </div>
            <p className="text-xs text-ink-muted mt-2">Each hotel in your trip gets a distinct colour bar under the day header.</p>
          </div>
        </section>

        {error && (
          <div className="border border-rust bg-sakura-soft rounded-lg p-4 text-sm">
            <strong>Couldn&apos;t save:</strong> {error}
          </div>
        )}
        {saved && (
          <div className="border border-sage bg-sage-soft rounded-lg p-4 text-sm text-sage-dark">
            ✓ Saved.
          </div>
        )}

        <div className="flex items-center justify-end border-t border-line pt-6 gap-3">
          <button type="submit" disabled={pending} className="btn-ink">
            {pending ? 'Saving…' : <>Save changes <ArrowRight className="w-4 h-4" /></>}
          </button>
        </div>
      </form>

      {/* Danger zone */}
      <section className="border border-rust/40 rounded-xl bg-sakura-soft/40 p-6">
        <div className="flex items-start gap-3 mb-4">
          <AlertTriangle className="w-5 h-5 text-rust shrink-0 mt-0.5" />
          <div>
            <h3 className="font-display text-xl text-wine">Danger zone</h3>
            <p className="text-sm text-ink-soft mt-1">
              Deleting this trip removes <strong>all {trip.bookingsCount} bookings and {trip.documentsCount} documents</strong> associated with it. The incoming email archive is also cleared. This cannot be undone.
            </p>
          </div>
        </div>

        <div className="bg-paper-pure border border-line rounded-lg p-4 space-y-3">
          <label className="text-xs text-ink-muted block">
            Type <code className="num-mono text-ink">{trip.name}</code> to confirm:
          </label>
          <input
            className="input"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={trip.name}
          />
          <button
            type="button"
            disabled={confirmText !== trip.name || deletePending}
            onClick={performDelete}
            className="px-4 py-2 rounded-md text-sm font-medium bg-wine text-paper-pure disabled:opacity-30 disabled:cursor-not-allowed inline-flex items-center gap-2 hover:opacity-90"
          >
            <Trash2 className="w-3.5 h-3.5" /> {deletePending ? 'Deleting…' : 'Delete this trip'}
          </button>
        </div>
      </section>
    </div>
  )
}
