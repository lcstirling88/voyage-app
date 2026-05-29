import { Search, Plus } from 'lucide-react'
import type { Trip } from '@prisma/client'
import { LocalClockClient } from './LocalClockClient'
import { TopBarBreadcrumb } from './TopBarClient'
import { timezoneForCity, labelFromTimezone } from '@/lib/cities'
import { getTripSegments, activeSegment } from '@/lib/segments'

/**
 * Sticky top bar on every trip page: breadcrumb on the left, two clocks +
 * search + add on the right. The two clocks are "home" (the trip's departure
 * city) and "destination". On a multi-country trip the destination clock
 * follows the ACTIVE leg — where you are right now (or the next leg before
 * departure) — so the timezone tracks you across the trip.
 *
 * FX/currency conversion used to live here too — moved out so the bar
 * stays focused on time. Currency belongs on the Costs feature page.
 */
export async function TopBar({ trip }: { trip: Trip }) {
  // Destination clock — driven by the active trip leg (handles multi-country).
  const segments = await getTripSegments(trip)
  const active = activeSegment(segments)
  const destTimezone = active?.timezone && active.timezone !== 'UTC'
    ? active.timezone
    : (trip.timezone && trip.timezone !== 'UTC' ? trip.timezone : 'UTC')
  const destLabel = labelFromTimezone(destTimezone, active?.country ?? trip.destination)

  // Home clock — derived from the trip's departure city. If unknown, hide it.
  const homeTimezone = timezoneForCity(trip.departureCity)
  const homeLabel = homeTimezone ? labelFromTimezone(homeTimezone) : null

  return (
    // Sticky header. The outer element carries the iOS notch inset
    // (safe-area-inset-top) as padding so, in an installed PWA, the blurred bar
    // extends up under the status bar and the content row sits clear of the
    // notch — both at rest and when pinned on scroll. Resolves to 0 in a normal
    // browser tab, so desktop/web is unchanged.
    <header className="border-b border-line bg-paper-pure/80 backdrop-blur sticky top-0 z-30 pt-[env(safe-area-inset-top)]">
      <div className="h-14 lg:h-16 flex items-center px-4 sm:px-6 lg:px-8 gap-3 lg:gap-6">
        <TopBarBreadcrumb tripName={trip.name} />
        <div className="flex-1" />

        {/* Home clock (e.g. Brisbane) — only when we can map the city. */}
        {homeTimezone && homeLabel && (
          <LocalClockClient timezone={homeTimezone} cityLabel={homeLabel} />
        )}
        {/* Destination clock (e.g. Auckland) — always shown. Skip the clock
            icon when there's already a home clock to its left so the row
            doesn't repeat the same glyph twice. */}
        <LocalClockClient
          timezone={destTimezone}
          cityLabel={destLabel}
          showIcon={!homeTimezone}
        />

        <button className="hidden sm:inline-flex px-3 py-1.5 text-sm rounded-md hover:bg-line-soft items-center gap-2">
          <Search className="w-4 h-4" /><span className="hidden md:inline">Search</span>
        </button>
        <button className="px-3 py-1.5 text-sm rounded-md bg-ink text-paper-pure hover:opacity-90 inline-flex items-center gap-2">
          <Plus className="w-4 h-4" /><span className="hidden sm:inline">Add</span>
        </button>
      </div>
    </header>
  )
}
