/**
 * Previous trips — completed itineraries the user can revisit or share.
 *
 * "Completed" here is strict: the trip's endDate is before today. Trips
 * still in progress live on the profile page as an Active Trip Card.
 *
 * Grouped by year (most recent first) so a long travel history reads as
 * a museum-shelf of finished journeys rather than an endless feed.
 */

import Link from 'next/link'
import { startOfDay, format } from 'date-fns'
import { ChevronLeft, Archive, Sparkles } from 'lucide-react'
import { prisma } from '@/lib/db'
import { requireUser } from '@/lib/session'
import { profileForDestination } from '@/lib/destinations'
import { ItineraBrand } from '@/components/ItineraBrand'

export default async function PastTripsPage() {
  const user = await requireUser()
  const today = startOfDay(new Date())

  const memberships = await prisma.membership.findMany({
    where: { userId: user.id, trip: { endDate: { lt: today } } },
    include: { trip: true },
    orderBy: { trip: { endDate: 'desc' } },
  })
  const trips = memberships.map((m) => m.trip)

  // Group by year (calendar year of endDate)
  const byYear = new Map<number, typeof trips>()
  for (const t of trips) {
    const y = t.endDate.getFullYear()
    if (!byYear.has(y)) byYear.set(y, [])
    byYear.get(y)!.push(t)
  }
  const years = [...byYear.keys()].sort((a, b) => b - a)

  return (
    <main className="min-h-screen bg-paper-pure">
      <header className="border-b border-line px-5 sm:px-10 py-4 flex items-center justify-between">
        <Link href="/profile" className="text-xs text-ink-muted hover:text-ink ulink inline-flex items-center gap-1.5">
          <ChevronLeft className="w-3.5 h-3.5" /> Profile
        </Link>
        <Link href="/" aria-label="Home">
          <ItineraBrand size="sm" />
        </Link>
        <div className="w-16" />
      </header>

      <div className="max-w-3xl mx-auto px-5 sm:px-10 pt-8 sm:pt-12 pb-12 sm:pb-16">
        <div className="text-[10px] uppercase tracking-[0.22em] text-ink-muted flex items-center gap-2">
          <Archive className="w-3 h-3" /> Previous Trips
        </div>
        <h1 className="h-display text-3xl sm:text-5xl mt-1">
          {trips.length === 0 ? 'No completed trips yet.' : trips.length === 1 ? 'One journey behind you.' : `${trips.length} journeys behind you.`}
        </h1>
        <p className="text-sm text-ink-muted mt-2">
          Revisit any trip, or share the itinerary with someone you travelled with.
        </p>

        {trips.length === 0 && (
          <div className="border border-line rounded-xl bg-paper-pure p-8 sm:p-10 text-center mt-8">
            <Sparkles className="w-6 h-6 text-sage mx-auto mb-3" />
            <p className="text-sm text-ink-muted max-w-md mx-auto">
              Once a trip&apos;s end date passes, it&apos;ll appear here for you to look back on.
            </p>
          </div>
        )}

        {years.map((year) => (
          <section key={year} className="mt-10">
            <div className="text-[11px] uppercase tracking-[0.24em] text-ink-muted mb-3 num-mono">
              {year}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              {byYear.get(year)!.map((trip) => {
                const profile = profileForDestination(trip.destination)
                const hero = profile.heroImage
                return (
                  <Link
                    key={trip.id}
                    href={`/trips/${trip.slug}`}
                    className="block group rounded-xl overflow-hidden border border-line bg-line-soft relative h-40 sm:h-44 shadow-soft hover:shadow-lift transition"
                    aria-label={`Open ${profile.label} trip`}
                  >
                    {hero ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={hero.src}
                        alt={hero.alt}
                        className="absolute inset-0 w-full h-full object-cover transition duration-500 group-hover:scale-105"
                        style={{ objectPosition: hero.objectPosition ?? 'center' }}
                      />
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-br from-sage to-ink" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/30 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5 text-paper-pure">
                      <div className="text-[10px] uppercase tracking-[0.22em] text-paper-pure/75 num-mono">
                        {format(trip.startDate, 'MMM d')} – {format(trip.endDate, 'MMM d, yyyy')}
                      </div>
                      <h2 className="font-display text-lg sm:text-xl mt-1 leading-tight">
                        {profile.label} Trip
                      </h2>
                      {trip.name !== profile.label && (
                        <div className="text-xs text-paper-pure/70 truncate mt-0.5">
                          {trip.name}
                        </div>
                      )}
                    </div>
                  </Link>
                )
              })}
            </div>
          </section>
        ))}
      </div>
    </main>
  )
}
