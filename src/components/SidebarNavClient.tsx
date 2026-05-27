'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Compass, Sparkles, Mail, Settings as SettingsIcon,
} from 'lucide-react'

// The 6 trip features (Itinerary, Costs, Weather, Local Info, Documents,
// Packing Assist) live as app-style tiles on the Overview page instead of
// here — the sidebar now keeps just the "home" links (Overview, Assistant)
// plus the utility footer (Inbox, Settings).
const items = [
  { tab: 'overview',   label: 'Overview',          Icon: Compass },
  { tab: 'assistant',  label: 'AI Assistant',      Icon: Sparkles },
] as const

export function SidebarNavClient({ tripSlug, emailCount }: { tripSlug: string; emailCount: number }) {
  const pathname = usePathname()
  const activeTab = pathname?.split('/').filter(Boolean)[2] ?? 'overview'

  return (
    <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
      {items.map(({ tab, label, Icon }) => {
        const active = tab === activeTab
        return (
          <Link
            key={tab}
            href={`/trips/${tripSlug}/${tab}`}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
              active ? 'bg-ink text-paper-pure' : 'text-ink hover:bg-line-soft'
            }`}
          >
            <Icon className={`w-4 h-4 ${active ? 'text-sakura' : ''}`} />
            <span>{label}</span>
          </Link>
        )
      })}

      <div className="pt-4 mt-4 border-t border-line">
        <div className="text-[10px] uppercase tracking-[0.18em] text-ink-muted mb-2 px-3">Inbox</div>
        <Link
          href={`/trips/${tripSlug}/inbox`}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition ${
            activeTab === 'inbox' ? 'bg-ink text-paper-pure' : 'hover:bg-line-soft'
          }`}
        >
          <Mail className={`w-4 h-4 ${activeTab === 'inbox' ? 'text-sakura' : 'text-ink-muted'}`} />
          <span className="flex-1 text-left">Forward bookings</span>
          <span className="text-[10px] num-mono text-ink-muted">{emailCount}</span>
        </Link>
        <Link
          href={`/trips/${tripSlug}/settings`}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition ${
            activeTab === 'settings' ? 'bg-ink text-paper-pure' : 'hover:bg-line-soft'
          }`}
        >
          <SettingsIcon className={`w-4 h-4 ${activeTab === 'settings' ? 'text-sakura' : 'text-ink-muted'}`} />
          <span className="flex-1 text-left">Trip settings</span>
        </Link>
      </div>
    </nav>
  )
}
