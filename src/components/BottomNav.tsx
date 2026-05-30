'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, CalendarDays, Folder, Wallet, Mail } from 'lucide-react'

/**
 * Mobile-only bottom tab bar.
 *
 * The trip shell has no sidebar, and the TopBar breadcrumb back-links are
 * hidden on mobile — so previously the only way "back" was the browser's
 * swipe gesture, which meant tapping back repeatedly to reach the trip home.
 *
 * This fixed bar gives one-tap access to the four most-used sections plus
 * Home (the Overview launcher, which links on to every other feature). It
 * sits above the iOS home indicator via the safe-area inset and hides on
 * lg+ where the breadcrumb is visible.
 */
const ITEMS = [
  { seg: 'overview', label: 'Home', Icon: Home },
  { seg: 'itinerary', label: 'Itinerary', Icon: CalendarDays },
  { seg: 'documents', label: 'Docs', Icon: Folder },
  { seg: 'costs', label: 'Costs', Icon: Wallet },
  { seg: 'inbox', label: 'Emails', Icon: Mail },
] as const

export function BottomNav({ tripSlug }: { tripSlug: string }) {
  const pathname = usePathname() ?? ''
  // Path shape: /trips/{slug}/{tab}/... — index 2 of the filtered segments.
  const segments = pathname.split('/').filter(Boolean)
  const activeSeg = segments[2] ?? 'overview'

  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-line bg-paper-pure/95 backdrop-blur-sm pb-[env(safe-area-inset-bottom)]"
      aria-label="Trip sections"
    >
      <div className="grid grid-cols-5">
        {ITEMS.map(({ seg, label, Icon }) => {
          const active = activeSeg === seg
          return (
            <Link
              key={seg}
              href={`/trips/${tripSlug}/${seg}`}
              aria-current={active ? 'page' : undefined}
              className={`flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] transition ${
                active ? 'text-sage' : 'text-ink-muted hover:text-ink'
              }`}
            >
              <Icon className="w-5 h-5" strokeWidth={active ? 2.25 : 1.75} />
              <span className="tracking-tight">{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
