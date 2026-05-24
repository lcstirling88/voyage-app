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
}

export function TopBarBreadcrumb({ tripName }: { tripName: string }) {
  const pathname = usePathname() ?? ''
  const seg = pathname.split('/').filter(Boolean)[2] ?? 'overview'
  return (
    <div className="flex items-center gap-2 text-sm text-ink-muted">
      <span>Trips</span>
      <ChevronRight className="w-3.5 h-3.5" />
      <span>{tripName}</span>
      <ChevronRight className="w-3.5 h-3.5" />
      <span className="text-ink">{tabTitles[seg] ?? seg}</span>
    </div>
  )
}
