import { Search, Plus } from 'lucide-react'
import type { Trip } from '@prisma/client'
import { LocalClockClient } from './LocalClockClient'
import { TopBarBreadcrumb } from './TopBarClient'
import { profileForDestination } from '@/lib/destinations'
import { timezoneForCity, labelFromTimezone } from '@/lib/cities'

/**
 * Sticky top bar on every trip page: breadcrumb on the left, two clocks +
 * search + add on the right. The two clocks are "home" (the trip's
 * departure city) and "destination" (the trip's country), giving the
 * user an at-a-glance feel for both timezones without leaving the trip.
 *
 * FX/currency conversion used to live here too — moved out so the bar
 * stays focused on time. Currency belongs on the Costs feature page.
 */
export function TopBar({ trip }: { trip: Trip }) {
  const profile = profileForDestination(trip.destination)

  // Destination clock — trip.timezone if set, otherwise the profile's default.
  const destTimezone = trip.timezone && trip.timezone !== 'UTC' ? trip.timezone : profile.timezone
  const destLabel = labelFromTimezone(
    destTimezone,
    profile.label !== 'Unknown' ? profile.label : trip.destination,
  )

  // Home clock — derived from the trip's departure city. If unknown, hide it.
  const homeTimezone = timezoneForCity(trip.departureCity)
  const homeLabel = homeTimezone ? labelFromTimezone(homeTimezone) : null

  return (
    <header className="h-14 lg:h-16 border-b border-line bg-paper-pure/80 backdrop-blur sticky top-0 z-30 flex items-center px-4 sm:px-6 lg:px-8 gap-3 lg:gap-6">
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
    </header>
  )
}
