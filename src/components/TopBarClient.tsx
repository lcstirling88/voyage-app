'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { ChevronRight, ChevronsUpDown, Check, Plus, LayoutGrid } from 'lucide-react'

const tabTitles: Record<string, string> = {
  overview: 'Overview',
  itinerary: 'Itinerary',
  costs: 'Costs & Payments',
  cancellations: 'Cancellations',
  weather: 'Weather',
  currency: 'Currency',
  local: 'Local Info',
  documents: 'Documents',
  checklist: 'Packing Assist',
  assistant: 'AI Assistant',
  inbox: 'Emails',
  settings: 'Trip settings',
}

export function TopBarBreadcrumb({
  tripName,
  trips,
}: {
  tripName: string
  trips: { slug: string; name: string }[]
}) {
  const pathname = usePathname() ?? ''
  const segments = pathname.split('/').filter(Boolean)
  const slug = segments[1] ?? ''
  const seg = segments[2] ?? 'overview'
  const tab = tabTitles[seg] ?? seg

  return (
    <div className="flex items-center gap-2 text-sm text-ink-muted min-w-0">
      {/* Breadcrumb root on tablet+ */}
      <Link href="/profile" className="hidden md:inline hover:text-ink ulink shrink-0">
        My Profile
      </Link>
      <ChevronRight className="hidden md:inline w-3.5 h-3.5 shrink-0" />
      {/* Trip switcher — jump to another trip, the trips list, or a new trip
          from anywhere in-trip. Replaces both the old plain trip-name link and
          the mobile back-chevron: "home" (overview) is now one tap away in the
          bottom nav, so this slot is freed up to fix the #6 complaint — being
          "locked into" a trip once you opened it, with no way back to others. */}
      <TripSwitcher trips={trips} currentSlug={slug} tripName={tripName} />
      <ChevronRight className="hidden md:inline w-3.5 h-3.5 shrink-0" />
      <span className="hidden md:inline text-ink truncate">{tab}</span>
    </div>
  )
}

/**
 * Dropdown that switches between the user's trips. Works on mobile + desktop:
 * the trigger shows the current trip name (so you always know where you are),
 * and the menu lists every trip plus shortcuts to the full trips list and the
 * new-trip flow.
 */
function TripSwitcher({
  trips,
  currentSlug,
  tripName,
}: {
  trips: { slug: string; name: string }[]
  currentSlug: string
  tripName: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const pathname = usePathname()

  // Dismiss on outside click / Escape.
  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  // Close after navigating to another trip / route.
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  return (
    <div className="relative min-w-0" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Switch trip"
        className="inline-flex items-center gap-1 min-w-0 max-w-[170px] sm:max-w-[220px] text-ink font-medium md:font-normal hover:text-ink/70 transition"
      >
        <span className="truncate">{tripName}</span>
        <ChevronsUpDown className="w-3.5 h-3.5 shrink-0 text-ink-muted" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-0 top-full mt-2 w-60 max-w-[80vw] rounded-lg border border-line bg-paper-pure shadow-soft py-1.5 z-40"
        >
          <div className="px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-ink-muted">
            Your trips
          </div>
          <div className="max-h-64 overflow-y-auto">
            {trips.map((t) => {
              const current = t.slug === currentSlug
              return (
                <Link
                  key={t.slug}
                  href={`/trips/${t.slug}/overview`}
                  role="menuitem"
                  className={`flex items-center justify-between gap-2 px-3 py-2 text-sm transition ${
                    current ? 'text-ink' : 'text-ink-muted hover:text-ink hover:bg-line-soft'
                  }`}
                >
                  <span className="truncate">{t.name}</span>
                  {current && <Check className="w-3.5 h-3.5 text-sage shrink-0" />}
                </Link>
              )
            })}
          </div>
          <div className="border-t border-line my-1" />
          <Link
            href="/trips"
            role="menuitem"
            className="flex items-center gap-2 px-3 py-2 text-sm text-ink-muted hover:text-ink hover:bg-line-soft transition"
          >
            <LayoutGrid className="w-4 h-4 shrink-0" /> All trips
          </Link>
          <Link
            href="/trips/new"
            role="menuitem"
            className="flex items-center gap-2 px-3 py-2 text-sm text-ink-muted hover:text-ink hover:bg-line-soft transition"
          >
            <Plus className="w-4 h-4 shrink-0" /> New trip
          </Link>
        </div>
      )}
    </div>
  )
}
