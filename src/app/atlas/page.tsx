/**
 * Atlas — the user's personal world map of trips planned and taken.
 *
 * Visual logic on the map:
 *  - Countries with no trip: muted warm grey.
 *  - Countries with only upcoming trips: hatched pattern (anticipation, not
 *    earned yet — they haven't actually been there).
 *  - Countries with completed trips: filled in a sage tier-fill based on the
 *    cumulative completed days the user has spent there:
 *      Touchdown   1-3   days  →  very pale sage   (★)
 *      Visited     4-14  days  →  medium sage      (★★)
 *      Explored    15-30 days  →  full sage        (★★★)
 *      Lived       31+   days  →  deep sage + gold edge on the map polygon
 *                                  and a 👑 stamp on the card.
 *
 * Card progression mirrors the map: stars + tier label, gold stamp at the
 * top tier, "Repeat visitor" chip on 2+ trips regardless of tier. Each
 * country card has an id so clicking the country on the map smooth-scrolls
 * to its details.
 */

import Link from 'next/link'
import { differenceInDays, startOfDay, format } from 'date-fns'
import { Globe, Sparkles, Crown } from 'lucide-react'
import { prisma } from '@/lib/db'
import { requireUser } from '@/lib/session'
import { profileForDestination } from '@/lib/destinations'
import {
  COUNTRY_PATHS, ATLAS_VIEW_WIDTH, ATLAS_VIEW_HEIGHT,
  tierForDays, UPCOMING_ONLY_FILL, UNVISITED_FILL, LIVED_EDGE_COLOR,
  type AtlasCountrySummary, type AtlasTierSpec,
} from '@/lib/atlas'

const COUNTRY_STROKE = '#FBF8F1'

/**
 * Build a Twemoji CDN URL from a unicode emoji string. Twemoji renders the
 * same emoji as a consistent flat-design SVG on every device, so the country
 * stickers look polished regardless of the user's OS emoji set.
 */
function twemojiUrl(emoji: string): string {
  const codepoints = [...emoji]
    .map((c) => c.codePointAt(0)!)
    .filter((cp) => cp !== 0xFE0F)  // strip variation-selector-16
    .map((cp) => cp.toString(16))
    .join('-')
  return `https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.1.0/assets/svg/${codepoints}.svg`
}

export default async function AtlasPage() {
  const user = await requireUser()

  const memberships = await prisma.membership.findMany({
    where: { userId: user.id },
    include: { trip: true },
    orderBy: { trip: { startDate: 'asc' } },
  })
  const trips = memberships.map((m) => m.trip)

  // Aggregate trips by ISO country code.
  const today = startOfDay(new Date())
  const byCountry = new Map<string, AtlasCountrySummary>()
  for (const trip of trips) {
    const profile = profileForDestination(trip.destination)
    if (!profile.isoNumeric) continue
    const days = Math.max(1, differenceInDays(startOfDay(trip.endDate), startOfDay(trip.startDate)) + 1)
    const completed = startOfDay(trip.endDate) < today
    const existing = byCountry.get(profile.isoNumeric)
    if (existing) {
      existing.totalDays += days
      if (completed) existing.completedDays += days
      existing.tripCount += 1
      if (completed) existing.hasCompleted = true
      else existing.hasUpcoming = true
      existing.trips.push({
        slug: trip.slug, name: trip.name,
        startDate: trip.startDate, endDate: trip.endDate, days, completed,
      })
    } else {
      byCountry.set(profile.isoNumeric, {
        isoNumeric: profile.isoNumeric,
        label: profile.label,
        passportIcon: profile.passportIcon ?? null,
        totalDays: days,
        completedDays: completed ? days : 0,
        tripCount: 1,
        hasCompleted: completed,
        hasUpcoming: !completed,
        trips: [{
          slug: trip.slug, name: trip.name,
          startDate: trip.startDate, endDate: trip.endDate, days, completed,
        }],
      })
    }
  }

  const countries = [...byCountry.values()].sort((a, b) => {
    // Trophies first (any completed days), then most depth.
    if (a.hasCompleted !== b.hasCompleted) return a.hasCompleted ? -1 : 1
    if (a.completedDays !== b.completedDays) return b.completedDays - a.completedDays
    return b.totalDays - a.totalDays
  })

  const totalDays = countries.reduce((s, c) => s + c.totalDays, 0)
  const totalCountries = countries.length

  // Per-country render hints for the SVG: { tier (if completed), upcoming-only }
  const renderHints = new Map<string, { tier: AtlasTierSpec | null; upcomingOnly: boolean }>()
  for (const c of countries) {
    renderHints.set(c.isoNumeric, {
      tier: c.completedDays > 0 ? tierForDays(c.completedDays) : null,
      upcomingOnly: c.completedDays === 0 && c.hasUpcoming,
    })
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
              <pattern
                id="hatch-upcoming"
                width="6"
                height="6"
                patternUnits="userSpaceOnUse"
                patternTransform="rotate(45)"
              >
                <rect width="6" height="6" fill="#A8B7AE" />
                <rect width="3" height="6" fill="#3F5B4E" />
              </pattern>
            </defs>

            <rect width={ATLAS_VIEW_WIDTH} height={ATLAS_VIEW_HEIGHT} fill="#F4EFE3" />

            {COUNTRY_PATHS.map((c) => {
              const hint = renderHints.get(c.id)
              const fill = hint?.tier
                ? hint.tier.mapFill
                : hint?.upcomingOnly
                  ? UPCOMING_ONLY_FILL
                  : UNVISITED_FILL
              // Lived tier gets a thicker gold edge to mark the top rank.
              const stroke = hint?.tier?.isLived ? LIVED_EDGE_COLOR : COUNTRY_STROKE
              const strokeWidth = hint?.tier?.isLived ? 1.4 : 0.5

              const path = (
                <path key={c.id} d={c.d} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
              )
              if (!hint) return path
              return (
                <a key={c.id} href={`#country-${c.id}`} aria-label={`${c.name} — jump to trip card`}>
                  {path}
                </a>
              )
            })}
          </svg>

          {totalCountries > 0 && (
            <div className="mt-3 sm:mt-4 flex items-center justify-center gap-3 sm:gap-5 text-[9px] sm:text-[10px] uppercase tracking-[0.18em] text-ink-muted flex-wrap">
              <LegendSwatch color="#C8D4CC" label="★ Touchdown" />
              <LegendSwatch color="#7A9387" label="★★ Visited" />
              <LegendSwatch color="#3F5B4E" label="★★★ Explored" />
              <LegendSwatch color="#243730" label="★★★★ Lived" border={LIVED_EDGE_COLOR} />
              <LegendSwatch
                label="Going there"
                gradient={`repeating-linear-gradient(45deg, #3F5B4E 0 3px, #A8B7AE 3px 6px)`}
              />
            </div>
          )}
        </div>
      </section>

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
          countries.map((c) => <CountryCard key={c.isoNumeric} country={c} />)
        )}
      </div>
    </>
  )
}

function LegendSwatch({
  color, gradient, label, border,
}: {
  color?: string
  gradient?: string
  label: string
  border?: string
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="w-3 h-3 rounded-sm shrink-0"
        style={{
          background: gradient ?? color,
          ...(border ? { outline: `1.5px solid ${border}`, outlineOffset: '-1.5px' } : {}),
        }}
        aria-hidden
      />
      {label}
    </span>
  )
}

function CountryCard({ country }: { country: AtlasCountrySummary }) {
  const tier = country.completedDays > 0 ? tierForDays(country.completedDays) : null
  const isRepeatVisitor = country.tripCount >= 2

  return (
    <div
      id={`country-${country.isoNumeric}`}
      className="border border-line rounded-xl bg-paper-pure p-4 sm:p-5 scroll-mt-24 flex items-start gap-4"
    >
      {/* Sticker tile — Twemoji SVG so the flat-design illustration is
          consistent on every device. */}
      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg bg-line-soft shrink-0 grid place-items-center overflow-hidden">
        {country.passportIcon ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={twemojiUrl(country.passportIcon)}
            alt={country.label}
            className="w-10 h-10 sm:w-12 sm:h-12"
          />
        ) : (
          <span className="text-3xl sm:text-4xl">🗺️</span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <h2 className="font-display text-xl sm:text-2xl">{country.label}</h2>
          <span className="text-[10px] uppercase tracking-[0.18em] text-ink-muted shrink-0">
            {country.totalDays} {country.totalDays === 1 ? 'day' : 'days'} · {country.tripCount} {country.tripCount === 1 ? 'trip' : 'trips'}
          </span>
        </div>

        {/* Tier + repeat-visitor badges */}
        <div className="mt-1.5 flex items-center gap-2 flex-wrap">
          {tier && (
            <span
              className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.18em] px-2 py-0.5 rounded-md"
              style={{
                background: tier.isLived ? LIVED_EDGE_COLOR : '#EFE9DA',
                color: tier.isLived ? '#FBF8F1' : '#5C4938',
              }}
            >
              {tier.isLived && <Crown className="w-3 h-3" />}
              <span>{'★'.repeat(tier.stars)}</span>
              <span>{tier.label}</span>
            </span>
          )}
          {!tier && country.hasUpcoming && (
            <span className="text-[10px] uppercase tracking-[0.18em] text-ink-muted px-2 py-0.5 rounded-md border border-line">
              Upcoming · not yet visited
            </span>
          )}
          {isRepeatVisitor && (
            <span className="text-[10px] uppercase tracking-[0.18em] text-sage px-2 py-0.5 rounded-md border border-sage/30 bg-sage-soft/60">
              Repeat visitor · {country.tripCount} trips
            </span>
          )}
        </div>

        <div className="mt-3 space-y-1">
          {country.trips.map((t) => (
            <Link
              key={t.slug}
              href={`/trips/${t.slug}`}
              className="flex items-center gap-2 text-sm hover:bg-line-soft/40 -mx-2 px-2 py-1 rounded transition"
            >
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${t.completed ? 'bg-sage' : 'bg-gold'}`}
                aria-label={t.completed ? 'completed' : 'upcoming'}
              />
              <span className="flex-1 min-w-0 truncate">{t.name}</span>
              <span className="text-xs text-ink-muted shrink-0 num-mono">
                {format(t.startDate, 'MMM yyyy')}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
