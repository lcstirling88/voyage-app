/**
 * My Profile — the user's account home.
 *
 * The visual centerpiece is the world atlas, framed in a premium gold
 * surround (museum / vintage-map vibe) — meant to feel like a curated
 * artifact of the user's travels, not a utility chart. Tap the framed
 * atlas to drill into /atlas for the full country-card detail.
 *
 * Underneath sit the identity block, stats roll-up, and quick links.
 * loadAtlasForUser is the single source of truth for both the map's
 * country highlights and the stat numbers, so they can never drift.
 */

import Link from 'next/link'
import { ChevronLeft, LogOut, Plane, Globe, MapPin, Maximize2 } from 'lucide-react'
import { differenceInDays, startOfDay } from 'date-fns'
import { prisma } from '@/lib/db'
import { requireUser } from '@/lib/session'
import { signOut } from '@/lib/auth'
import { loadAtlasForUser, renderHintsFromCountries } from '@/lib/atlas'
import { ItineraBrand } from '@/components/ItineraBrand'
import { WorldMapSvg } from '@/components/WorldMapSvg'

// Gold palette used across the frame. Brighter at the top-left, deeper at
// the bottom-right — fakes the brushed-metal sheen of a real picture frame.
const GOLD_GRADIENT = 'linear-gradient(135deg, #E8C078 0%, #B8893B 45%, #8B6730 100%)'
const GOLD_EDGE_DARK = 'rgba(60, 40, 15, 0.35)'
const GOLD_EDGE_LIGHT = 'rgba(255, 240, 200, 0.45)'

export default async function ProfilePage() {
  const user = await requireUser()
  const { countries, totalDays, totalTrips, manualByIso } = await loadAtlasForUser(user.id)
  const renderHints = renderHintsFromCountries(countries)
  const totalCountries = countries.length

  // Upcoming count separately — still useful for the small "upcoming" hint on
  // the trips stat card below the atlas.
  const memberships = await prisma.membership.findMany({
    where: { userId: user.id },
    include: { trip: true },
  })
  const today = startOfDay(new Date())
  const upcomingTrips = memberships.filter((m) => startOfDay(m.trip.endDate) >= today).length

  const displayName = user.name || user.email?.split('@')[0] || 'You'
  const initial = (displayName || 'V').charAt(0).toUpperCase()

  // Tiny aside — distinct manual entries vs Voyage-planned trips.
  const manualCount = manualByIso.size
  const plannedCount = totalTrips

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

      <div className="max-w-3xl mx-auto px-5 sm:px-10 py-6 sm:py-10">

        {/* ----- HERO: the framed atlas ---------------------------------- */}
        <div>
          <div className="text-[10px] uppercase tracking-[0.22em] text-ink-muted text-center mb-3 sm:mb-4">
            My passport
          </div>

          {/* Outer Link wraps everything so the whole framed piece is one
              tappable target into /atlas. Hover adds a subtle lift. */}
          <Link
            href="/atlas"
            className="block group relative"
            aria-label="Open my atlas — full world map and country detail"
          >
            {/* GOLD FRAME — outer band with brushed-metal gradient + inset
                light/dark edges to give it weight. */}
            <div
              className="rounded-md p-2.5 sm:p-3.5 transition group-hover:shadow-lift"
              style={{
                background: GOLD_GRADIENT,
                boxShadow: `
                  inset 0 0 0 1px ${GOLD_EDGE_LIGHT},
                  inset 0 0 0 2px ${GOLD_EDGE_DARK},
                  inset 0 0 0 6px ${GOLD_EDGE_LIGHT},
                  0 10px 28px -14px rgba(168, 129, 75, 0.55),
                  0 2px 6px -2px rgba(60, 40, 15, 0.25)
                `,
              }}
            >
              {/* MAT — paper-toned inner surround, like the white border
                  around a painting before the frame. */}
              <div
                className="bg-paper-pure rounded-sm p-2 sm:p-3 relative"
                style={{ boxShadow: `inset 0 0 0 1px ${GOLD_EDGE_DARK}` }}
              >
                <WorldMapSvg
                  renderHints={renderHints}
                  className="w-full h-auto"
                  ariaLabel="World map of countries you've travelled to"
                />

                {/* Small chip in the corner hinting at the click target. */}
                <div className="absolute top-3 right-3 inline-flex items-center gap-1 text-[9px] uppercase tracking-[0.18em] text-ink-muted bg-paper-pure/90 backdrop-blur px-2 py-1 rounded border border-line opacity-0 group-hover:opacity-100 transition">
                  <Maximize2 className="w-2.5 h-2.5" />
                  Open atlas
                </div>
              </div>
            </div>

            {/* MUSEUM PLAQUE — italic caption beneath the frame. */}
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
        </div>

        {/* ----- Identity & detail (under the hero) ---------------------- */}
        <div className="mt-12 sm:mt-16 pt-6 border-t border-line">
          <div className="flex items-center gap-4 sm:gap-5">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-sage grid place-items-center text-paper-pure font-display text-xl sm:text-2xl shrink-0">
              {initial}
            </div>
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-[0.22em] text-ink-muted">My profile</div>
              <h1 className="h-display text-2xl sm:text-4xl mt-0.5 truncate">{displayName}</h1>
              <p className="text-xs sm:text-sm text-ink-muted truncate">{user.email}</p>
            </div>
          </div>

          {/* Stats — same numbers as the museum plaque but broken out. */}
          <div className="mt-6 sm:mt-8 grid grid-cols-3 gap-3 sm:gap-5">
            <Stat icon={<Globe className="w-4 h-4 text-sage" />} value={totalCountries} label={totalCountries === 1 ? 'country' : 'countries'} sub={manualCount > 0 ? `${manualCount} added by hand` : undefined} />
            <Stat icon={<MapPin className="w-4 h-4 text-sage" />} value={totalDays} label={totalDays === 1 ? 'day' : 'days'} />
            <Stat icon={<Plane className="w-4 h-4 text-sage" />} value={plannedCount} label={plannedCount === 1 ? 'trip' : 'trips'} sub={upcomingTrips > 0 ? `${upcomingTrips} upcoming` : undefined} />
          </div>

          {/* Quick links */}
          <div className="mt-6 sm:mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                <div className="text-xs text-ink-muted">Country detail + add visits</div>
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
      </div>
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
