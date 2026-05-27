/**
 * Atlas overview — world map + per-country cards.
 *
 * The SVG map and the trip aggregation live in shared helpers
 * (components/WorldMapSvg, lib/atlas) so the full-screen route at
 * /atlas/map can render the same map without duplicating logic.
 */

import Link from 'next/link'
import { startOfDay, format } from 'date-fns'
import { Globe, Sparkles, Crown, Maximize2, MapPin } from 'lucide-react'
import { requireUser } from '@/lib/session'
import {
  loadAtlasForUser, renderHintsFromCountries, tierForDays,
  LIVED_EDGE_COLOR,
  type AtlasCountrySummary, type AtlasManualVisit,
} from '@/lib/atlas'
import { listDestinations } from '@/lib/destinations'
import { WorldMapSvg } from '@/components/WorldMapSvg'
import { AddVisitedCountryClient } from '@/components/AddVisitedCountryClient'
import { deleteVisitedCountry } from '@/lib/actions'

function twemojiUrl(emoji: string): string {
  const codepoints = [...emoji]
    .map((c) => c.codePointAt(0)!)
    .filter((cp) => cp !== 0xFE0F)
    .map((cp) => cp.toString(16))
    .join('-')
  return `https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.1.0/assets/svg/${codepoints}.svg`
}

export default async function AtlasPage() {
  const user = await requireUser()
  const { countries, totalDays, totalTrips, manualByIso } = await loadAtlasForUser(user.id)
  const renderHints = renderHintsFromCountries(countries)
  const totalCountries = countries.length
  const destinationOptions = listDestinations().map((d) => ({
    isoNumeric: d.isoNumeric!,
    label: d.label,
    passportIcon: d.passportIcon,
  }))

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
            <span className="font-medium text-ink">{totalTrips}</span> {totalTrips === 1 ? 'trip' : 'trips'}
          </p>
        ) : (
          <p className="text-ink-muted mt-2 text-sm sm:text-base">
            Plan your first trip and your atlas starts filling in.
          </p>
        )}
      </div>

      <section className="border-b border-line bg-paper-pure relative">
        <div className="px-0 sm:px-2 py-3 sm:py-4 relative">
          <WorldMapSvg
            renderHints={renderHints}
            className="w-full h-auto"
            anchorPrefix="#country-"
          />

          {/* Full-screen toggle — opens /atlas/map which lays the map out at
              100vw × 100vh, naturally landscape-oriented on a rotated phone. */}
          <Link
            href="/atlas/map"
            aria-label="Open the world map full screen"
            className="absolute top-3 right-3 inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-ink-muted bg-paper-pure/85 backdrop-blur px-2.5 py-1.5 rounded-md border border-line hover:text-ink hover:border-ink transition"
          >
            <Maximize2 className="w-3 h-3" />
            <span className="hidden sm:inline">Full view</span>
          </Link>

          {totalCountries > 0 && (
            <div className="mt-3 sm:mt-4 px-3 sm:px-0 flex items-center justify-center gap-3 sm:gap-5 text-[9px] sm:text-[10px] uppercase tracking-[0.18em] text-ink-muted flex-wrap">
              <LegendSwatch color="#C8D4CC" label="★ Touchdown" />
              <LegendSwatch color="#7A9387" label="★★ Visited" />
              <LegendSwatch color="#3F5B4E" label="★★★ Explored" />
              <LegendSwatch color="#243730" label="★★★★ Lived" border={LIVED_EDGE_COLOR} />
              <LegendSwatch
                label="Going there"
                gradient="repeating-linear-gradient(45deg, #3F5B4E 0 3px, #A8B7AE 3px 6px)"
              />
            </div>
          )}
        </div>
      </section>

      <div className="px-4 sm:px-10 py-6 sm:py-10 max-w-3xl space-y-4">
        {countries.length === 0 && (
          <div className="border border-line rounded-xl bg-paper-pure p-8 sm:p-10 text-center">
            <Sparkles className="w-6 h-6 text-sage mx-auto mb-3" />
            <h2 className="font-display text-2xl mb-2">An empty map is a beginning.</h2>
            <p className="text-sm text-ink-muted max-w-md mx-auto mb-5">
              Plan a trip, or add a country below for somewhere you&apos;ve already been.
            </p>
            <Link href="/trips/new" className="btn-ink">Plan a trip</Link>
          </div>
        )}

        {countries.map((c) => (
          <CountryCard
            key={c.isoNumeric}
            country={c}
            manualVisit={manualByIso.get(c.isoNumeric) ?? null}
          />
        ))}

        {/* Form to add a country you've already been to. Always visible at the
            bottom of the list so the map can keep filling in over time. */}
        <AddVisitedCountryClient options={destinationOptions} />
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

function CountryCard({
  country, manualVisit,
}: {
  country: AtlasCountrySummary
  manualVisit: AtlasManualVisit | null
}) {
  const tier = country.completedDays > 0 ? tierForDays(country.completedDays) : null
  const isRepeatVisitor = country.tripCount >= 2

  return (
    <div
      id={`country-${country.isoNumeric}`}
      className="border border-line rounded-xl bg-paper-pure p-4 sm:p-5 scroll-mt-24 flex items-start gap-4"
    >
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
                {format(startOfDay(t.startDate), 'MMM yyyy')}
              </span>
            </Link>
          ))}

          {manualVisit && (
            <div className="flex items-center gap-2 text-sm -mx-2 px-2 py-1 rounded">
              <MapPin className="w-3 h-3 text-ink-muted shrink-0" />
              <span className="flex-1 min-w-0 truncate text-ink-soft italic">
                {manualVisit.note ?? 'Visited (no plan in app)'}
              </span>
              {manualVisit.yearVisited != null && (
                <span className="text-xs text-ink-muted shrink-0 num-mono">
                  {manualVisit.yearVisited}
                </span>
              )}
              <form action={deleteVisitedCountry}>
                <input type="hidden" name="isoNumeric" value={country.isoNumeric} />
                <button
                  type="submit"
                  className="text-[10px] uppercase tracking-[0.18em] text-ink-muted hover:text-rust ml-1 ulink"
                  title="Remove this manual entry"
                  aria-label="Remove manual entry"
                >
                  Remove
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
