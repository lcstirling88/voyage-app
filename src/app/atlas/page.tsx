/**
 * Atlas — the user's personal world map of trips planned and taken.
 *
 * The map shows every country they have a Voyage trip in, filled with a
 * soft accent (solid for completed trips, diagonally hatched when their
 * only trips to that country are still upcoming). Below the map, a list of
 * country cards with a flat-emoji passport sticker, country name, total
 * days, and the underlying trips. Clicking a country anchor-jumps to the
 * matching card.
 *
 * This is intentionally engagement-shaped: as the user logs more trips,
 * the map fills in — a personal trophy case that's painful to abandon.
 */

import Link from 'next/link'
import { differenceInDays, startOfDay, format } from 'date-fns'
import { Globe, Sparkles } from 'lucide-react'
import { prisma } from '@/lib/db'
import { requireUser } from '@/lib/session'
import { profileForDestination } from '@/lib/destinations'
import {
  COUNTRY_PATHS, ATLAS_VIEW_WIDTH, ATLAS_VIEW_HEIGHT,
  type AtlasCountrySummary,
} from '@/lib/atlas'

const VISITED_FILL = '#3F5B4E'        // sage — same family as accents elsewhere
const VISITED_FILL_LIGHT = '#7A9387'   // lighter sage for hover/borders
const UNVISITED_FILL = '#E8E2D4'       // soft warm grey, paper-aligned
const COUNTRY_STROKE = '#FBF8F1'        // paper-pure for thin borders

export default async function AtlasPage() {
  const user = await requireUser()

  // Every trip the user is a member of, oldest start first.
  const memberships = await prisma.membership.findMany({
    where: { userId: user.id },
    include: { trip: true },
    orderBy: { trip: { startDate: 'asc' } },
  })
  const trips = memberships.map((m) => m.trip)

  // Aggregate trips by ISO country code (skips trips whose destination text
  // we don't have an ISO mapping for; user can still see them on /trips).
  const today = startOfDay(new Date())
  const byCountry = new Map<string, AtlasCountrySummary>()
  for (const trip of trips) {
    const profile = profileForDestination(trip.destination)
    if (!profile.isoNumeric) continue
    const days = Math.max(1, differenceInDays(startOfDay(trip.endDate), startOfDay(trip.startDate)) + 1)
    const completed = startOfDay(trip.endDate) < today
    const upcoming = !completed
    const existing = byCountry.get(profile.isoNumeric)
    if (existing) {
      existing.totalDays += days
      existing.tripCount += 1
      if (completed) existing.hasCompleted = true
      if (upcoming) existing.hasUpcoming = true
      existing.trips.push({
        slug: trip.slug, name: trip.name,
        startDate: trip.startDate, endDate: trip.endDate, days,
      })
    } else {
      byCountry.set(profile.isoNumeric, {
        isoNumeric: profile.isoNumeric,
        label: profile.label,
        passportIcon: profile.passportIcon ?? null,
        totalDays: days,
        tripCount: 1,
        hasCompleted: completed,
        hasUpcoming: upcoming,
        trips: [{
          slug: trip.slug, name: trip.name,
          startDate: trip.startDate, endDate: trip.endDate, days,
        }],
      })
    }
  }

  const countries = [...byCountry.values()].sort((a, b) => {
    // Completed countries first (they're the trophies), then upcoming.
    if (a.hasCompleted !== b.hasCompleted) return a.hasCompleted ? -1 : 1
    return b.totalDays - a.totalDays
  })

  // Top-line stats
  const totalDays = countries.reduce((s, c) => s + c.totalDays, 0)
  const totalCountries = countries.length

  // Lookup tables for the SVG renderer
  const fillByIso = new Map<string, 'completed' | 'upcoming'>()
  for (const c of countries) {
    fillByIso.set(c.isoNumeric, c.hasCompleted ? 'completed' : 'upcoming')
  }

  return (
    <>
      <div className="hero-light border-b border-line px-6 sm:px-10 py-6 sm:py-8">
        <div className="text-[10px] uppercase tracking-[0.22em] text-ink-muted flex items-center gap-2">
          <Globe className="w-3 h-3" /> Atlas
        </div>
        <h1 className="h-display text-4xl sm:text-6xl mt-1">Your world.</h1>
        {totalCountries > 0 ? (
          <p className="text-ink-muted mt-2 text-sm sm:text-base">
            <span className="font-medium text-ink">{totalCountries}</span> {totalCountries === 1 ? 'country' : 'countries'} ·{' '}
            <span className="font-medium text-ink">{totalDays}</span> {totalDays === 1 ? 'day' : 'days'} ·{' '}
            <span className="font-medium text-ink">{trips.length}</span> {trips.length === 1 ? 'trip' : 'trips'}
          </p>
        ) : (
          <p className="text-ink-muted mt-2 text-sm sm:text-base">
            Plan your first trip and your atlas starts filling in.
          </p>
        )}
      </div>

      <section className="border-b border-line bg-paper-pure">
        <div className="px-2 sm:px-6 py-4 sm:py-6">
          <svg
            viewBox={`0 0 ${ATLAS_VIEW_WIDTH} ${ATLAS_VIEW_HEIGHT}`}
            className="w-full h-auto max-h-[55vh]"
            role="img"
            aria-label="World map highlighting countries you have trips in"
          >
            <defs>
              {/* Hatched fill pattern for upcoming-only countries */}
              <pattern
                id="hatch-upcoming"
                width="6"
                height="6"
                patternUnits="userSpaceOnUse"
                patternTransform="rotate(45)"
              >
                <rect width="6" height="6" fill={VISITED_FILL_LIGHT} />
                <rect width="3" height="6" fill={VISITED_FILL} />
              </pattern>
            </defs>

            {/* Soft ocean / page background */}
            <rect width={ATLAS_VIEW_WIDTH} height={ATLAS_VIEW_HEIGHT} fill="#F4EFE3" />

            {COUNTRY_PATHS.map((c) => {
              const status = fillByIso.get(c.id)
              const fill =
                status === 'completed' ? VISITED_FILL :
                status === 'upcoming' ? 'url(#hatch-upcoming)' :
                UNVISITED_FILL
              const path = (
                <path
                  key={c.id}
                  d={c.d}
                  fill={fill}
                  stroke={COUNTRY_STROKE}
                  strokeWidth={0.5}
                />
              )
              if (!status) return path
              // Wrap visited countries in an in-page anchor link to their card
              return (
                <a key={c.id} href={`#country-${c.id}`} aria-label={`${c.name} — jump to trip card`}>
                  {path}
                </a>
              )
            })}
          </svg>

          {/* Legend */}
          {totalCountries > 0 && (
            <div className="mt-3 sm:mt-4 flex items-center justify-center gap-5 text-[10px] uppercase tracking-[0.18em] text-ink-muted">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm" style={{ background: VISITED_FILL }} aria-hidden />
                Been there
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm" style={{ background: 'url(#hatch-upcoming)', backgroundImage: `repeating-linear-gradient(45deg, ${VISITED_FILL} 0 3px, ${VISITED_FILL_LIGHT} 3px 6px)` }} aria-hidden />
                Going there
              </span>
            </div>
          )}
        </div>
      </section>

      {/* Country cards */}
      <div className="px-4 sm:px-10 py-6 sm:py-10 max-w-3xl space-y-4">
        {countries.length === 0 ? (
          <div className="border border-line rounded-xl bg-paper-pure p-8 sm:p-10 text-center">
            <Sparkles className="w-6 h-6 text-sage mx-auto mb-3" />
            <h2 className="font-display text-2xl mb-2">An empty map is a beginning.</h2>
            <p className="text-sm text-ink-muted max-w-md mx-auto mb-5">
              Once you create your first trip, the country lights up on the map above and a card appears down here with your days, dates, and a little keepsake icon.
            </p>
            <Link href="/trips/new" className="btn-ink">Plan a trip</Link>
          </div>
        ) : (
          countries.map((c) => (
            <CountryCard key={c.isoNumeric} country={c} />
          ))
        )}
      </div>
    </>
  )
}

function CountryCard({ country }: { country: AtlasCountrySummary }) {
  return (
    <div
      id={`country-${country.isoNumeric}`}
      className="border border-line rounded-xl bg-paper-pure p-4 sm:p-5 scroll-mt-24 flex items-start gap-4"
    >
      {/* Sticker tile */}
      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg bg-line-soft shrink-0 grid place-items-center text-3xl sm:text-4xl">
        {country.passportIcon ?? '🗺️'}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <h2 className="font-display text-xl sm:text-2xl">{country.label}</h2>
          <span className="text-[10px] uppercase tracking-[0.18em] text-ink-muted shrink-0">
            {country.totalDays} {country.totalDays === 1 ? 'day' : 'days'} · {country.tripCount} {country.tripCount === 1 ? 'trip' : 'trips'}
          </span>
        </div>

        <div className="mt-2 space-y-1">
          {country.trips.map((t) => {
            const isUpcoming = startOfDay(t.endDate) >= startOfDay(new Date())
            return (
              <Link
                key={t.slug}
                href={`/trips/${t.slug}`}
                className="flex items-center gap-2 text-sm hover:bg-line-soft/40 -mx-2 px-2 py-1 rounded transition"
              >
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isUpcoming ? 'bg-gold' : 'bg-sage'}`} />
                <span className="flex-1 min-w-0 truncate">{t.name}</span>
                <span className="text-xs text-ink-muted shrink-0 num-mono">
                  {format(t.startDate, 'MMM yyyy')}
                </span>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
