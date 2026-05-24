'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { ChevronsUpDown, Plus, Check } from 'lucide-react'
import { getTheme } from '@/lib/theme'

export type TripSummary = {
  slug: string
  name: string
  destination: string
  themeKey: string
}

export function TripSwitcherClient({
  currentSlug,
  trips,
}: {
  currentSlug: string
  trips: TripSummary[]
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  const current = trips.find((t) => t.slug === currentSlug)
  if (!current) return null

  const currentTheme = getTheme(current.themeKey)

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left px-3 py-3 rounded-lg hover:bg-line-soft transition flex items-center gap-3"
      >
        <div
          className="w-10 h-10 rounded-md shrink-0"
          style={{ background: currentTheme.heroGradient }}
        />
        <div className="min-w-0 flex-1">
          <div className="font-display text-base leading-tight truncate">{current.name}</div>
          <div className="text-xs text-ink-muted truncate">{current.destination}</div>
        </div>
        <ChevronsUpDown className="w-4 h-4 text-ink-muted shrink-0" />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-2 z-30 bg-paper-pure border border-line rounded-lg shadow-lift overflow-hidden">
          <div className="max-h-72 overflow-y-auto">
            {trips.map((trip) => {
              const theme = getTheme(trip.themeKey)
              const active = trip.slug === currentSlug
              return (
                <Link
                  key={trip.slug}
                  href={`/trips/${trip.slug}/overview`}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-3 py-2.5 hover:bg-line-soft transition"
                >
                  <div className="w-8 h-8 rounded-md shrink-0" style={{ background: theme.heroGradient }} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{trip.name}</div>
                    <div className="text-[11px] text-ink-muted truncate">{trip.destination}</div>
                  </div>
                  {active && <Check className="w-3.5 h-3.5 text-sage shrink-0" />}
                </Link>
              )
            })}
          </div>
          <Link
            href="/trips/new"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2.5 border-t border-line text-sm hover:bg-line-soft transition"
          >
            <Plus className="w-4 h-4 text-sage" />
            <span>Plan a new trip</span>
          </Link>
          <Link
            href="/trips"
            onClick={() => setOpen(false)}
            className="block px-3 py-2 text-[11px] text-ink-muted hover:bg-line-soft transition text-center border-t border-line"
          >
            See all trips
          </Link>
        </div>
      )}
    </div>
  )
}
