'use client'

import { usePathname } from 'next/navigation'
import { ChevronRight } from 'lucide-react'

const tabTitles: Record<string, string> = {
  overview: 'Overview',
  itinerary: 'Itinerary',
  costs: 'Costs & Payments',
  weather: 'Weather',
  local: 'Local Info',
  documents: 'Documents',
  checklist: 'Checklist',
  assistant: 'AI Assistant',
  inbox: 'Inbox',
  settings: 'Settings',
}

export function TopBarBreadcrumb({ tripName }: { tripName: string }) {
  const pathname = usePathname() ?? ''
  const seg = pathname.split('/').filter(Boolean)[2] ?? 'overview'
  const tab = tabTitles[seg] ?? seg

  return (
    <div className="flex items-center gap-2 text-sm text-ink-muted min-w-0">
      {/* Full breadcrumb on tablet+ */}
      <span className="hidden md:inline">Trips</span>
      <ChevronRight className="hidden md:inline w-3.5 h-3.5" />
      <span className="hidden md:inline truncate max-w-[200px]">{tripName}</span>
      <ChevronRight className="hidden md:inline w-3.5 h-3.5" />
      <span className="text-ink truncate">{tab}</span>
    </div>
  )
}
