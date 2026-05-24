import Link from 'next/link'
import { Settings, LogOut } from 'lucide-react'
import type { Trip } from '@prisma/client'
import { prisma } from '@/lib/db'
import { auth, signOut } from '@/lib/auth'
import { SidebarNavClient } from './SidebarNavClient'
import { TripSwitcherClient } from './TripSwitcherClient'

export async function Sidebar({
  trip,
  emailCount,
  currentUserId,
}: {
  trip: Trip
  emailCount: number
  currentUserId: string
}) {
  // Only show trips the current user is a member of in the switcher
  const allTrips = await prisma.trip.findMany({
    where: { memberships: { some: { userId: currentUserId } } },
    orderBy: { startDate: 'asc' },
    select: { slug: true, name: true, destination: true, themeKey: true },
  })

  const session = await auth()
  const displayName = session?.user?.name || session?.user?.email?.split('@')[0] || 'You'
  const displayEmail = session?.user?.email ?? ''
  const initial = (displayName || 'V').charAt(0).toUpperCase()

  return (
    <aside className="w-64 shrink-0 border-r border-line bg-paper-pure flex flex-col h-screen sticky top-0">
      <div className="p-6 border-b border-line">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-ink grid place-items-center">
            <span className="font-display text-paper-pure text-lg leading-none">V</span>
          </div>
          <div>
            <div className="font-display text-xl leading-none">Voyage</div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-ink-muted mt-0.5">Travel, considered.</div>
          </div>
        </Link>
      </div>

      <div className="p-4 border-b border-line">
        <div className="text-[10px] uppercase tracking-[0.18em] text-ink-muted mb-2 px-2">Current trip</div>
        <TripSwitcherClient currentSlug={trip.slug} trips={allTrips} />
      </div>

      <SidebarNavClient tripSlug={trip.slug} emailCount={emailCount} />

      <div className="p-4 border-t border-line">
        <div className="flex items-center gap-3 px-2">
          <div className="w-9 h-9 rounded-full bg-sage grid place-items-center text-paper-pure font-display text-sm">
            {initial}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{displayName}</div>
            <div className="text-xs text-ink-muted truncate">{displayEmail}</div>
          </div>
          <form action={async () => { 'use server'; await signOut({ redirectTo: '/signin' }) }}>
            <button type="submit" className="text-ink-muted hover:text-ink" title="Sign out">
              <LogOut className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </aside>
  )
}
