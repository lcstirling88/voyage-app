import { Search, Plus } from 'lucide-react'
import type { Trip } from '@prisma/client'
import { LocalClockClient } from './LocalClockClient'
import { TopBarBreadcrumb } from './TopBarClient'
import { MobileMenuButton } from './MobileMenuButton'
import { profileForDestination, fxLabel as buildFxLabel } from '@/lib/destinations'

export function TopBar({ trip }: { trip: Trip }) {
  const profile = profileForDestination(trip.destination)
  const timezone = trip.timezone && trip.timezone !== 'UTC' ? trip.timezone : profile.timezone
  const localCurrency = trip.localCurrency ?? profile.currency
  const cityLabel = trip.destination?.split(/[, ]/)[0] ?? profile.label
  const fx = trip.homeCurrency && localCurrency && trip.homeCurrency !== localCurrency
    ? buildFxLabel(trip.homeCurrency, localCurrency)
    : null

  return (
    <header className="h-14 lg:h-16 border-b border-line bg-paper-pure/80 backdrop-blur sticky top-0 z-30 flex items-center px-4 sm:px-6 lg:px-8 gap-3 lg:gap-6">
      <MobileMenuButton />
      <TopBarBreadcrumb tripName={trip.name} />
      <div className="flex-1" />
      <LocalClockClient timezone={timezone} cityLabel={cityLabel} fxLabel={fx} />
      <button className="hidden sm:inline-flex px-3 py-1.5 text-sm rounded-md hover:bg-line-soft items-center gap-2">
        <Search className="w-4 h-4" /><span className="hidden md:inline">Search</span>
      </button>
      <button className="px-3 py-1.5 text-sm rounded-md bg-ink text-paper-pure hover:opacity-90 inline-flex items-center gap-2">
        <Plus className="w-4 h-4" /><span className="hidden sm:inline">Add</span>
      </button>
    </header>
  )
}
