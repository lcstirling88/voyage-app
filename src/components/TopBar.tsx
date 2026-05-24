import { Search, Plus } from 'lucide-react'
import type { Trip } from '@prisma/client'
import { TokyoClockClient } from './TokyoClockClient'
import { TopBarBreadcrumb } from './TopBarClient'
import { MobileMenuButton } from './MobileMenuButton'

export function TopBar({ trip }: { trip: Trip }) {
  return (
    <header className="h-14 lg:h-16 border-b border-line bg-paper-pure/80 backdrop-blur sticky top-0 z-30 flex items-center px-4 sm:px-6 lg:px-8 gap-3 lg:gap-6">
      <MobileMenuButton />
      <TopBarBreadcrumb tripName={trip.name} />
      <div className="flex-1" />
      <TokyoClockClient />
      <button className="hidden sm:inline-flex px-3 py-1.5 text-sm rounded-md hover:bg-line-soft items-center gap-2">
        <Search className="w-4 h-4" /><span className="hidden md:inline">Search</span>
      </button>
      <button className="px-3 py-1.5 text-sm rounded-md bg-ink text-paper-pure hover:opacity-90 inline-flex items-center gap-2">
        <Plus className="w-4 h-4" /><span className="hidden sm:inline">Add</span>
      </button>
    </header>
  )
}
