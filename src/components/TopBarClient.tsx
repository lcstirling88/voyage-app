'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronRight } from 'lucide-react'

const tabTitles: Record<string, string> = {
  overview: 'Overview',
  itinerary: 'Itinerary',
  costs: 'Costs & Payments',
  weather: 'Weather',
  local: 'Local Info',
  documents: 'Documents',
  checklist: 'Packing Assist',
  assistant: 'AI Assistant',
  inbox: 'Forward bookings',
  settings: 'Trip settings',
}

export function TopBarBreadcrumb({ tripName }: { tripName: string }) {
  const pathname = usePathname() ?? ''
  const segments = pathname.split('/').filter(Boolean)
  const slug = segments[1] ?? ''
  const seg = segments[2] ?? 'overview'
  const tab = tabTitles[seg] ?? seg
  const onOverview = seg === 'overview'

  return (
    <div className="flex items-center gap-2 text-sm text-ink-muted min-w-0">
      {/* Full breadcrumb on tablet+ */}
      <Link href="/profile" className="hidden md:inline hover:text-ink ulink">
        My Profile
      </Link>
      <ChevronRight className="hidden md:inline w-3.5 h-3.5" />
      {/* Trip name links back to the Overview "home screen". On the overview
          itself it's already current, so render it as plain text instead of
          a self-link. */}
      {onOverview ? (
        <span className="hidden md:inline truncate max-w-[200px] text-ink">
          {tripName}
        </span>
      ) : (
        <Link
          href={`/trips/${slug}/overview`}
          className="hidden md:inline truncate max-w-[200px] hover:text-ink ulink"
        >
          {tripName}
        </Link>
      )}
      <ChevronRight className="hidden md:inline w-3.5 h-3.5" />
      <span className="text-ink truncate">{tab}</span>
    </div>
  )
}
