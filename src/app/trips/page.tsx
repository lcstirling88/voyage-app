import Link from 'next/link'
import { Plus, Globe } from 'lucide-react'
import { prisma } from '@/lib/db'
import { requireUser } from '@/lib/session'
import { fmtDateRange, daysUntil } from '@/lib/format'
import { getTheme } from '@/lib/theme'

export default async function TripsListPage() {
  const user = await requireUser()

  // Only show trips where this user is a member
  const trips = await prisma.trip.findMany({
    where: { memberships: { some: { userId: user.id } } },
    orderBy: { startDate: 'asc' },
    include: {
      cities: { orderBy: { displayOrder: 'asc' } },
      memberships: { include: { user: true } },
    },
  })

  return (
    <main className="min-h-screen px-6 sm:px-10 py-10 sm:py-16 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.22em] text-ink-muted">Itinera</div>
          <h1 className="h-display text-4xl sm:text-6xl mt-2">Your trips.</h1>
          <p className="text-ink-muted mt-3 max-w-xl text-sm sm:text-base">Every flight, hotel, activity and document — gathered, parsed, and ready.</p>
        </div>
        <div className="text-left sm:text-right">
          <Link
            href="/atlas"
            className="inline-flex items-center gap-1.5 text-xs ulink text-ink-muted hover:text-ink"
          >
            <Globe className="w-3.5 h-3.5" /> Atlas
          </Link>
          <div className="text-[10px] uppercase tracking-[0.18em] text-ink-muted mt-3">Signed in as</div>
          <div className="text-sm text-ink truncate max-w-[240px]">{user.email}</div>
          <form action={async () => { 'use server'; const { signOut } = await import('@/lib/auth'); await signOut({ redirectTo: '/signin' }) }}>
            <button className="text-xs text-ink-muted ulink mt-1">Sign out</button>
          </form>
        </div>
      </div>

      <div className="mt-12 space-y-4">
        {trips.length === 0 && (
          <div className="border-2 border-dashed border-line rounded-xl bg-paper/40 p-12 text-center">
            <div className="text-ink-muted text-sm">No trips yet. Plan one to get started.</div>
          </div>
        )}

        {trips.map((trip) => {
          const theme = getTheme(trip.themeKey)
          const cityNames = trip.cities.map((c) => c.name).filter((n, i, a) => a.indexOf(n) === i)
          const sharedWith = trip.memberships.filter((m) => m.userId !== user.id)
          return (
            <Link
              key={trip.id}
              href={`/trips/${trip.slug}/overview`}
              className="block border border-line rounded-xl bg-paper-pure overflow-hidden hover:shadow-soft transition"
            >
              <div className="flex flex-col sm:flex-row">
                <div className="h-24 sm:h-auto sm:w-48 shrink-0" style={{ background: theme.heroGradient }} />
                <div className="p-5 sm:p-6 flex-1 min-w-0">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-ink-muted">{trip.destination}</div>
                  <h2 className="font-display text-2xl sm:text-3xl mt-1">{trip.name}</h2>
                  {trip.tagline && <p className="text-sm text-ink-muted italic mt-1 max-w-2xl">{trip.tagline}</p>}
                  <div className="mt-4 flex flex-wrap gap-x-6 gap-y-3 sm:gap-8 text-xs text-ink-muted">
                    <div><div className="uppercase tracking-wider text-[10px]">When</div><div className="text-ink mt-0.5">{fmtDateRange(trip.startDate, trip.endDate)}</div></div>
                    <div><div className="uppercase tracking-wider text-[10px]">Countdown</div><div className="text-ink mt-0.5 num-mono">{daysUntil(trip.startDate)} days</div></div>
                    {cityNames.length > 0 && (
                      <div><div className="uppercase tracking-wider text-[10px]">Cities</div><div className="text-ink mt-0.5">{cityNames.join(' · ')}</div></div>
                    )}
                    {sharedWith.length > 0 && (
                      <div><div className="uppercase tracking-wider text-[10px]">Shared with</div><div className="text-ink mt-0.5">{sharedWith.map((m) => m.user.name ?? m.user.email).join(', ')}</div></div>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          )
        })}

        <Link
          href="/trips/new"
          className="block w-full border-2 border-dashed border-line rounded-xl bg-paper/40 hover:bg-paper-pure p-12 text-ink-muted hover:text-ink transition text-center"
        >
          <Plus className="w-5 h-5 inline mr-2" />
          Plan a new trip
        </Link>
      </div>
    </main>
  )
}
