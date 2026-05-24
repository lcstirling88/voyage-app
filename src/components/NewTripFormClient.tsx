'use client'

import { useState, useTransition, useEffect } from 'react'
import { ArrowRight, Sparkles } from 'lucide-react'
import { createTrip, type CreateTripResult } from '@/lib/actions'
import { deriveThemeFromDestination, themes, themeOptions, type ThemeKey } from '@/lib/theme'

const DEFAULT_CURRENCIES = ['AUD', 'USD', 'GBP', 'EUR', 'NZD', 'JPY', 'SGD']

export function NewTripFormClient() {
  const [name, setName] = useState('')
  const [tagline, setTagline] = useState('')
  const [destination, setDestination] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [homeCurrency, setHomeCurrency] = useState('AUD')
  const [travelerNames, setTravelerNames] = useState('')
  const [departureCity, setDepartureCity] = useState('')
  const [cities, setCities] = useState('')
  const [themeKey, setThemeKey] = useState<ThemeKey>('default')
  const [themeOverridden, setThemeOverridden] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  // Auto-derive theme when destination changes (unless user picked one manually)
  useEffect(() => {
    if (!themeOverridden) {
      setThemeKey(deriveThemeFromDestination(destination))
    }
  }, [destination, themeOverridden])

  const previewTheme = themes[themeKey]

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const fd = new FormData()
    fd.set('name', name)
    fd.set('tagline', tagline)
    fd.set('destination', destination)
    fd.set('startDate', startDate)
    fd.set('endDate', endDate)
    fd.set('homeCurrency', homeCurrency)
    fd.set('travelerNames', travelerNames)
    fd.set('departureCity', departureCity)
    fd.set('cities', cities)
    fd.set('themeKey', themeKey)

    startTransition(async () => {
      // Server action will redirect on success — we only see a result here on failure
      const res = (await createTrip(fd)) as CreateTripResult | undefined
      if (res && res.ok === false) setError(res.error)
    })
  }

  return (
    <form onSubmit={submit} className="space-y-8">
      {/* Live theme preview */}
      <div
        className="relative overflow-hidden rounded-2xl h-44 border border-line"
        style={{ background: previewTheme.heroGradient }}
      >
        {previewTheme.heroPattern === 'asanoha' && (
          <div className="pattern-asanoha absolute inset-0 opacity-30" />
        )}
        <div className="relative p-7">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-paper-pure/70 text-[10px] uppercase tracking-[0.25em]">
              {previewTheme.motif && <span className="mr-2">{previewTheme.motif}</span>}
              {previewTheme.scriptLine ?? destination ?? 'Preview'}
            </span>
          </div>
          <div className="h-display text-paper-pure text-5xl truncate">
            {name || 'Your next trip.'}
          </div>
          {tagline && (
            <div className="font-display italic text-paper-pure/70 text-sm mt-2 max-w-md truncate">
              {tagline}
            </div>
          )}
        </div>
      </div>

      {/* Fields */}
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
        <div className="col-span-2">
          <label className="text-[10px] uppercase tracking-[0.2em] text-ink-muted">Trip name *</label>
          <input
            className="input mt-1.5 text-2xl font-display"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. South Island Roadtrip"
            required
            maxLength={80}
          />
        </div>

        <div className="col-span-2">
          <label className="text-[10px] uppercase tracking-[0.2em] text-ink-muted">Tagline (optional)</label>
          <input
            className="input mt-1.5"
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            placeholder="One line about the trip"
            maxLength={140}
          />
        </div>

        <div>
          <label className="text-[10px] uppercase tracking-[0.2em] text-ink-muted">Destination (country) *</label>
          <input
            className="input mt-1.5"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder="e.g. New Zealand"
            required
          />
        </div>

        <div>
          <label className="text-[10px] uppercase tracking-[0.2em] text-ink-muted">Departure city</label>
          <input
            className="input mt-1.5"
            value={departureCity}
            onChange={(e) => setDepartureCity(e.target.value)}
            placeholder="e.g. Sydney"
          />
        </div>

        <div>
          <label className="text-[10px] uppercase tracking-[0.2em] text-ink-muted">Start date *</label>
          <input
            className="input mt-1.5 num-mono"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="text-[10px] uppercase tracking-[0.2em] text-ink-muted">End date *</label>
          <input
            className="input mt-1.5 num-mono"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="text-[10px] uppercase tracking-[0.2em] text-ink-muted">Home currency</label>
          <select
            className="input mt-1.5"
            value={homeCurrency}
            onChange={(e) => setHomeCurrency(e.target.value)}
          >
            {DEFAULT_CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div>
          <label className="text-[10px] uppercase tracking-[0.2em] text-ink-muted">Theme</label>
          <select
            className="input mt-1.5"
            value={themeKey}
            onChange={(e) => { setThemeKey(e.target.value as ThemeKey); setThemeOverridden(true) }}
          >
            {themeOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div className="col-span-2">
          <label className="text-[10px] uppercase tracking-[0.2em] text-ink-muted">Travellers</label>
          <input
            className="input mt-1.5"
            value={travelerNames}
            onChange={(e) => setTravelerNames(e.target.value)}
            placeholder="e.g. Liam Christiansen, +1"
          />
        </div>

        <div className="col-span-2">
          <label className="text-[10px] uppercase tracking-[0.2em] text-ink-muted">
            Cities you&apos;ll visit (optional · comma separated)
          </label>
          <input
            className="input mt-1.5"
            value={cities}
            onChange={(e) => setCities(e.target.value)}
            placeholder="e.g. Queenstown, Wanaka, Mount Cook, Christchurch"
          />
          <p className="text-xs text-ink-muted mt-1.5">
            Don&apos;t worry about being exhaustive — bookings will fill in the rest as you forward them.
          </p>
        </div>
      </section>

      {error && (
        <div className="border border-rust bg-sakura-soft rounded-lg p-4 text-sm">
          <strong>Couldn&apos;t create the trip:</strong> {error}
        </div>
      )}

      <div className="flex items-center justify-between border-t border-line pt-6">
        <div className="text-xs text-ink-muted flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-sage" />
          A unique inbox address will be generated for forwarding bookings.
        </div>
        <button
          type="submit"
          disabled={pending || !name || !destination || !startDate || !endDate}
          className="btn-ink"
        >
          {pending ? 'Creating…' : <>Create trip <ArrowRight className="w-4 h-4" /></>}
        </button>
      </div>
    </form>
  )
}
