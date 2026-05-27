/**
 * My Profile — the user's account home. Stats roll up across all their trips
 * (countries, days, upcoming) so this page doubles as a 'who I am as a
 * traveller' summary. Future versions can add edit fields, preferences,
 * connected accounts.
 */

import Link from 'next/link'
import { ChevronLeft, LogOut, User as UserIcon, Plane, Globe, MapPin } from 'lucide-react'
import { differenceInDays, startOfDay } from 'date-fns'
import { prisma } from '@/lib/db'
import { requireUser } from '@/lib/session'
import { signOut } from '@/lib/auth'
import { profileForDestination } from '@/lib/destinations'
import { ItineraBrand } from '@/components/ItineraBrand'

export default async function ProfilePage() {
  const user = await requireUser()

  // Roll-up stats across trips + manual visited countries.
  const [memberships, visited] = await Promise.all([
    prisma.membership.findMany({
      where: { userId: user.id },
      include: { trip: true },
    }),
    prisma.visitedCountry.findMany({ where: { userId: user.id } }),
  ])
  const trips = memberships.map((m) => m.trip)
  const today = startOfDay(new Date())

  let totalDays = 0
  let upcomingTrips = 0
  const countriesSeen = new Set<string>()
  for (const t of trips) {
    const d = Math.max(1, differenceInDays(startOfDay(t.endDate), startOfDay(t.startDate)) + 1)
    totalDays += d
    if (startOfDay(t.endDate) >= today) upcomingTrips++
    const iso = profileForDestination(t.destination).isoNumeric
    if (iso) countriesSeen.add(iso)
  }
  for (const v of visited) {
    countriesSeen.add(v.isoNumeric)
    totalDays += v.daysApprox ?? 1
  }

  const displayName = user.name || user.email?.split('@')[0] || 'You'
  const initial = (displayName || 'V').charAt(0).toUpperCase()

  return (
    <main className="min-h-screen bg-paper-pure">
      {/* Top bar with back link + brand */}
      <header className="border-b border-line px-5 sm:px-10 py-4 flex items-center justify-between">
        <Link href="/" className="text-xs text-ink-muted hover:text-ink ulink inline-flex items-center gap-1.5">
          <ChevronLeft className="w-3.5 h-3.5" /> Home
        </Link>
        <Link href="/" aria-label="Home">
          <ItineraBrand size="sm" />
        </Link>
        <div className="w-12" />
      </header>

      <div className="max-w-3xl mx-auto px-5 sm:px-10 py-8 sm:py-12">
        {/* Identity block */}
        <div className="flex items-center gap-4 sm:gap-5">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-sage grid place-items-center text-paper-pure font-display text-2xl sm:text-3xl shrink-0">
            {initial}
          </div>
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.22em] text-ink-muted">My profile</div>
            <h1 className="h-display text-3xl sm:text-5xl mt-1 truncate">{displayName}</h1>
            <p className="text-sm text-ink-muted truncate">{user.email}</p>
          </div>
        </div>

        {/* Stats roll-up */}
        <div className="mt-8 sm:mt-10 grid grid-cols-3 gap-3 sm:gap-6">
          <Stat icon={<Globe className="w-4 h-4 text-sage" />} value={countriesSeen.size} label={countriesSeen.size === 1 ? 'country' : 'countries'} />
          <Stat icon={<MapPin className="w-4 h-4 text-sage" />} value={totalDays} label={totalDays === 1 ? 'day' : 'days'} />
          <Stat icon={<Plane className="w-4 h-4 text-sage" />} value={trips.length} label={trips.length === 1 ? 'trip' : 'trips'} sub={upcomingTrips > 0 ? `${upcomingTrips} upcoming` : undefined} />
        </div>

        {/* Quick links */}
        <div className="mt-8 sm:mt-10 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Link
            href="/trips"
            className="border border-line rounded-xl bg-paper-pure p-5 hover:border-sage transition flex items-center gap-3"
          >
            <Plane className="w-5 h-5 text-ink-muted shrink-0" />
            <div className="min-w-0">
              <div className="font-display text-lg">My trips</div>
              <div className="text-xs text-ink-muted">Browse and plan</div>
            </div>
          </Link>
          <Link
            href="/atlas"
            className="border border-line rounded-xl bg-paper-pure p-5 hover:border-sage transition flex items-center gap-3"
          >
            <Globe className="w-5 h-5 text-ink-muted shrink-0" />
            <div className="min-w-0">
              <div className="font-display text-lg">My atlas</div>
              <div className="text-xs text-ink-muted">World map of where you&apos;ve been</div>
            </div>
          </Link>
        </div>

        {/* Account zone */}
        <div className="mt-10 sm:mt-14 pt-6 border-t border-line flex items-center justify-between gap-3">
          <div className="text-xs text-ink-muted">
            Signed in as <span className="text-ink">{user.email}</span>
          </div>
          <form action={async () => { 'use server'; await signOut({ redirectTo: '/' }) }}>
            <button
              type="submit"
              className="text-xs text-ink-muted hover:text-rust ulink inline-flex items-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" /> Sign out
            </button>
          </form>
        </div>
      </div>

      {/* Hidden but useful — keep the unused import warning at bay */}
      <div className="hidden"><UserIcon /></div>
    </main>
  )
}

function Stat({ icon, value, label, sub }: { icon: React.ReactNode; value: number; label: string; sub?: string }) {
  return (
    <div className="border border-line rounded-xl bg-paper-pure p-4 sm:p-5">
      <div className="flex items-center gap-2">
        {icon}
        <div className="text-[10px] uppercase tracking-[0.18em] text-ink-muted">{label}</div>
      </div>
      <div className="font-display text-3xl sm:text-4xl mt-2 num-mono">{value}</div>
      {sub && <div className="text-[10px] uppercase tracking-[0.18em] text-sage mt-1">{sub}</div>}
    </div>
  )
}
