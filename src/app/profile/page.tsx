/**
 * My Profile — the user's account home.
 *
 * The atlas is the page's centrepiece, set in a layered French-baroque
 * gold frame with ornamental corners. The map sits in a wider container
 * than the supporting detail underneath, so the framed artifact dominates
 * the screen the way a real picture frame would on a wall. Tapping the
 * framed atlas opens /atlas for the full country-card detail.
 */

import Link from 'next/link'
import { ChevronLeft, LogOut, Globe, Maximize2, Archive, ChevronRight } from 'lucide-react'
import { startOfDay } from 'date-fns'
import { prisma } from '@/lib/db'
import { requireUser } from '@/lib/session'
import { signOut } from '@/lib/auth'
import { loadAtlasForUser, renderHintsFromCountries } from '@/lib/atlas'
import { listDestinations } from '@/lib/destinations'
import { ItineraBrand } from '@/components/ItineraBrand'
import { WorldMapSvg } from '@/components/WorldMapSvg'
import { HomeCountryPickerClient } from '@/components/HomeCountryPickerClient'
import { PassportPickerClient } from '@/components/PassportPickerClient'
import { CountriesBadge } from '@/components/CountriesBadge'
import { ActiveTripCard } from '@/components/ActiveTripCard'

// Gold palette — warm tones tuned to read as a single layer of brushed metal.
const GOLD_HIGHLIGHT = '#E8C078'   // catch-light
const GOLD_MID       = '#B8893B'   // body
const GOLD_DEEP      = '#8B6730'   // shadow
const GOLD_DARKEST   = '#5C3F18'   // inset edge lines
const GOLD_MAIN_GRADIENT = `linear-gradient(135deg, ${GOLD_HIGHLIGHT} 0%, ${GOLD_MID} 45%, ${GOLD_DEEP} 100%)`

export default async function ProfilePage() {
  const user = await requireUser()
  const {
    countries, homeCountry, homeCountryIso, nationalityIso,
    totalDays,
  } = await loadAtlasForUser(user.id)
  const renderHints = renderHintsFromCountries(countries, homeCountryIso)
  const totalCountries = countries.length
  const destinationOptions = listDestinations().map((d) => ({
    isoNumeric: d.isoNumeric!,
    label: d.label,
    passportIcon: d.passportIcon,
  }))

  // Split memberships into active (endDate >= today — upcoming or in-progress)
  // and past (endDate < today). Profile shows the active ones as big hero
  // cards; past trips collapse into a single "Previous trips" link.
  const memberships = await prisma.membership.findMany({
    where: { userId: user.id },
    include: { trip: true },
    orderBy: { trip: { startDate: 'asc' } },
  })
  const today = startOfDay(new Date())
  const activeTrips = memberships
    .map((m) => m.trip)
    .filter((t) => startOfDay(t.endDate) >= today)
  const pastTripsCount = memberships.length - activeTrips.length

  const displayName = user.name || user.email?.split('@')[0] || 'You'
  const initial = (displayName || 'V').charAt(0).toUpperCase()

  return (
    <main className="min-h-screen bg-paper-pure">
      <header className="border-b border-line px-5 sm:px-10 py-4 flex items-center justify-between">
        <Link href="/" className="text-xs text-ink-muted hover:text-ink ulink inline-flex items-center gap-1.5">
          <ChevronLeft className="w-3.5 h-3.5" /> Home
        </Link>
        <Link href="/" aria-label="Home">
          <ItineraBrand size="sm" />
        </Link>
        <div className="w-12" />
      </header>

      {/* Identity masthead — you first; the framed atlas follows as the hero. */}
      <div className="max-w-3xl mx-auto px-5 sm:px-8 pt-6 sm:pt-8">
        <div className="flex items-center gap-4 sm:gap-5 pb-5 sm:pb-6 border-b border-line">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-sage grid place-items-center text-paper-pure font-display text-lg sm:text-2xl shrink-0">
            {initial}
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-xl sm:text-3xl truncate leading-tight">{displayName}</h1>
            <p className="text-xs sm:text-sm text-ink-muted truncate">{user.email}</p>
          </div>
        </div>
      </div>

      {/* ---------- HERO: framed atlas. Sized to match the supporting detail
           column below — feels more like a single composed page than a wide
           artifact + a narrow column under it. ---------- */}
      <div className="max-w-3xl mx-auto px-3 sm:px-8 pt-6 sm:pt-8">
        <div className="text-[10px] uppercase tracking-[0.22em] text-ink-muted text-center mb-4 sm:mb-5">
          My passport
        </div>

        <Link
          href="/atlas"
          className="block group"
          aria-label="Open my atlas — full world map and country detail"
        >
          {/* Outer brushed-gold band */}
          <div
            className="rounded-md p-2.5 sm:p-3.5 transition group-hover:shadow-lift"
            style={{
              background: GOLD_MAIN_GRADIENT,
              boxShadow: `
                inset 0 0 0 1px rgba(255, 240, 200, 0.5),
                inset 0 0 0 2px ${GOLD_DARKEST},
                inset 0 0 0 6px rgba(255, 240, 200, 0.3),
                0 10px 28px -14px rgba(168, 129, 75, 0.55),
                0 2px 6px -2px ${GOLD_DARKEST}
              `,
            }}
          >
            {/* Mat — paper-toned inner surround with a thin gold inner line */}
            <div
              className="bg-paper-pure rounded-sm p-2 sm:p-3 relative"
              style={{ boxShadow: `inset 0 0 0 1px ${GOLD_DARKEST}` }}
            >
              <WorldMapSvg
                renderHints={renderHints}
                className="w-full h-auto"
                ariaLabel="World map of countries you've travelled to"
              />

              <div className="absolute top-3 right-3 inline-flex items-center gap-1 text-[9px] uppercase tracking-[0.18em] text-ink-muted bg-paper-pure/90 backdrop-blur px-2 py-1 rounded border border-line opacity-0 group-hover:opacity-100 transition">
                <Maximize2 className="w-2.5 h-2.5" />
                Open atlas
              </div>
            </div>
          </div>

          {/* Museum plaque caption */}
          <div className="mt-4 sm:mt-5 text-center">
            <p className="font-display italic text-base sm:text-lg text-ink-soft">
              {totalCountries === 0
                ? 'An empty atlas — pick a country to begin.'
                : `${totalCountries} ${totalCountries === 1 ? 'country' : 'countries'} · ${totalDays} ${totalDays === 1 ? 'day' : 'days'} on the road`}
            </p>
            <p className="text-[10px] uppercase tracking-[0.22em] text-ink-muted/70 mt-1">
              Tap the map to open the full atlas
            </p>
          </div>
        </Link>

        {/* "Based in" — small editorial caption with inline picker. Sits
            outside the framed-atlas link so the select interactions don't
            fight with the link's navigation. */}
        <div className="mt-3 sm:mt-4 flex flex-col items-center gap-1.5">
          <HomeCountryPickerClient
            options={destinationOptions}
            currentIso={homeCountryIso}
            currentLabel={homeCountry?.label ?? null}
            currentIcon={homeCountry?.passportIcon ?? null}
          />
          <PassportPickerClient
            options={destinationOptions}
            passportIso={nationalityIso}
            homeIso={homeCountryIso}
          />
        </div>
      </div>

      {/* ---------- Identity + detail, in a narrower column ---------- */}
      <div className="max-w-3xl mx-auto px-5 sm:px-10 mt-12 sm:mt-16 pb-12 sm:pb-16">
        <div className="pt-6 border-t border-line">
          {/* Countries Visited — single full-width stat with a medallion-style
              tier badge. Tier ladder lives in lib/atlas (tierForCountryCount). */}
          <div className="mt-6 sm:mt-8">
            <div className="border border-line rounded-xl bg-paper-pure p-5 sm:p-6">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-sage" />
                    <div className="text-[10px] uppercase tracking-[0.18em] text-ink-muted">
                      Countries Visited
                    </div>
                  </div>
                  <div className="font-display text-4xl sm:text-5xl mt-2 num-mono">
                    {totalCountries}
                  </div>
                </div>
                <CountriesBadge count={totalCountries} />
              </div>
            </div>
          </div>

          {/* Active trips — one big hero-image card per upcoming/in-progress trip. */}
          {activeTrips.length > 0 && (
            <div className="mt-8 sm:mt-10">
              <div className="text-[10px] uppercase tracking-[0.22em] text-ink-muted mb-3 sm:mb-4">
                {activeTrips.length === 1 ? 'Coming up' : 'Coming up'}
              </div>
              <div className="space-y-3 sm:space-y-4">
                {activeTrips.map((t) => (
                  <ActiveTripCard key={t.id} trip={t} />
                ))}
              </div>
            </div>
          )}

          {/* Previous trips — single card linking to /trips/past. */}
          <div className="mt-8 sm:mt-10">
            <Link
              href="/trips/past"
              className="border border-line rounded-xl bg-paper-pure p-5 hover:border-sage transition flex items-center gap-3"
            >
              <Archive className="w-5 h-5 text-ink-muted shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="font-display text-lg">Previous trips</div>
                <div className="text-xs text-ink-muted">
                  {pastTripsCount === 0
                    ? 'No completed trips yet'
                    : `${pastTripsCount} ${pastTripsCount === 1 ? 'trip' : 'trips'} to look back on`}
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-ink-muted shrink-0" />
            </Link>
          </div>

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
      </div>
    </main>
  )
}


