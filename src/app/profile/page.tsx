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
import { ChevronLeft, LogOut, Plane, Globe, MapPin, Maximize2 } from 'lucide-react'
import { startOfDay } from 'date-fns'
import { prisma } from '@/lib/db'
import { requireUser } from '@/lib/session'
import { signOut } from '@/lib/auth'
import { loadAtlasForUser, renderHintsFromCountries } from '@/lib/atlas'
import { ItineraBrand } from '@/components/ItineraBrand'
import { WorldMapSvg } from '@/components/WorldMapSvg'

// French baroque gold palette — warm with depth, antiqued.
const GOLD_HIGHLIGHT = '#F0CF85'   // brightest, the catch-light
const GOLD_MID       = '#C29841'   // mid-band, the "body" of the gold
const GOLD_DEEP      = '#8C6420'   // shadowed valleys
const GOLD_DARKEST   = '#5A3F12'   // recessed grooves, edge lines
const GOLD_MAIN_GRADIENT = `linear-gradient(135deg, ${GOLD_HIGHLIGHT} 0%, ${GOLD_MID} 45%, ${GOLD_DEEP} 100%)`
const GOLD_INNER_GRADIENT = `linear-gradient(135deg, ${GOLD_MID} 0%, ${GOLD_DEEP} 100%)`

export default async function ProfilePage() {
  const user = await requireUser()
  const { countries, totalDays, totalTrips, manualByIso } = await loadAtlasForUser(user.id)
  const renderHints = renderHintsFromCountries(countries)
  const totalCountries = countries.length

  const memberships = await prisma.membership.findMany({
    where: { userId: user.id },
    include: { trip: true },
  })
  const today = startOfDay(new Date())
  const upcomingTrips = memberships.filter((m) => startOfDay(m.trip.endDate) >= today).length

  const displayName = user.name || user.email?.split('@')[0] || 'You'
  const initial = (displayName || 'V').charAt(0).toUpperCase()
  const manualCount = manualByIso.size

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

      {/* ---------- HERO: framed atlas, wider than the rest of the page ---------- */}
      <div className="max-w-5xl mx-auto px-3 sm:px-8 pt-6 sm:pt-10">
        <div className="text-[10px] uppercase tracking-[0.22em] text-ink-muted text-center mb-4 sm:mb-5">
          My passport
        </div>

        <Link
          href="/atlas"
          className="block group relative"
          aria-label="Open my atlas — full world map and country detail"
        >
          {/* 1. Outermost dark gold ring */}
          <div
            className="rounded-md p-[3px] sm:p-[4px]"
            style={{
              background: GOLD_DARKEST,
              boxShadow: `
                0 18px 40px -18px rgba(60, 40, 15, 0.55),
                0 6px 14px -4px rgba(60, 40, 15, 0.25)
              `,
            }}
          >
            {/* 2. Outer gold band with brushed-metal gradient */}
            <div
              className="relative rounded-sm p-3 sm:p-5"
              style={{
                background: GOLD_MAIN_GRADIENT,
                boxShadow: `
                  inset 0 0 0 1px rgba(255, 240, 200, 0.5),
                  inset 0 0 0 2px ${GOLD_DARKEST}
                `,
              }}
            >
              {/* Inner shadow groove between the outer band and the next layer */}
              <BeadEdge />

              {/* 3. Recessed dark groove between outer and inner gold */}
              <div
                className="rounded-sm p-[2px]"
                style={{
                  background: GOLD_DARKEST,
                  boxShadow: `inset 0 0 4px rgba(0, 0, 0, 0.35)`,
                }}
              >
                {/* 4. Inner gold band — slightly darker, narrower */}
                <div
                  className="rounded-sm p-1.5 sm:p-2"
                  style={{
                    background: GOLD_INNER_GRADIENT,
                    boxShadow: `
                      inset 0 0 0 1px rgba(255, 240, 200, 0.3),
                      inset 0 0 0 2px ${GOLD_DARKEST}
                    `,
                  }}
                >
                  {/* 5. Sharp dark inner line + paper-pure mat (the white border around the painting) */}
                  <div
                    className="bg-paper-pure rounded-[2px] p-1.5 sm:p-2.5 relative"
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
              </div>
            </div>
          </div>

          {/* Ornamental corners — small SVG flourishes at each outer corner.
              Sit slightly OUTSIDE the frame to break the rectangular line. */}
          <CornerOrnament corner="top-left" />
          <CornerOrnament corner="top-right" />
          <CornerOrnament corner="bottom-left" />
          <CornerOrnament corner="bottom-right" />

          {/* Museum plaque caption */}
          <div className="mt-5 sm:mt-7 text-center">
            <p className="font-display italic text-base sm:text-xl text-ink-soft">
              {totalCountries === 0
                ? 'An empty atlas — pick a country to begin.'
                : `${totalCountries} ${totalCountries === 1 ? 'country' : 'countries'} · ${totalDays} ${totalDays === 1 ? 'day' : 'days'} on the road`}
            </p>
            <p className="text-[10px] uppercase tracking-[0.22em] text-ink-muted/70 mt-1.5">
              Tap the map to open the full atlas
            </p>
          </div>
        </Link>
      </div>

      {/* ---------- Identity + detail, in a narrower column ---------- */}
      <div className="max-w-3xl mx-auto px-5 sm:px-10 mt-12 sm:mt-16 pb-12 sm:pb-16">
        <div className="pt-6 border-t border-line">
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

          <div className="mt-6 sm:mt-8 grid grid-cols-3 gap-3 sm:gap-5">
            <Stat icon={<Globe className="w-4 h-4 text-sage" />} value={totalCountries} label={totalCountries === 1 ? 'country' : 'countries'} sub={manualCount > 0 ? `${manualCount} added by hand` : undefined} />
            <Stat icon={<MapPin className="w-4 h-4 text-sage" />} value={totalDays} label={totalDays === 1 ? 'day' : 'days'} />
            <Stat icon={<Plane className="w-4 h-4 text-sage" />} value={totalTrips} label={totalTrips === 1 ? 'trip' : 'trips'} sub={upcomingTrips > 0 ? `${upcomingTrips} upcoming` : undefined} />
          </div>

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

/**
 * Embossed bead row along the inner edge of the outer gold band — a
 * classic French/baroque frame motif. Pure CSS: four absolute strips,
 * each tiled with a small radial gradient that reads as a single bead.
 */
function BeadEdge() {
  const beadH: React.CSSProperties = {
    backgroundImage: `radial-gradient(circle at 4.5px center, ${GOLD_HIGHLIGHT} 0.8px, ${GOLD_DEEP} 1.8px, transparent 2.6px)`,
    backgroundSize: '9px 5px',
    backgroundRepeat: 'repeat-x',
  }
  const beadV: React.CSSProperties = {
    backgroundImage: `radial-gradient(circle at center 4.5px, ${GOLD_HIGHLIGHT} 0.8px, ${GOLD_DEEP} 1.8px, transparent 2.6px)`,
    backgroundSize: '5px 9px',
    backgroundRepeat: 'repeat-y',
  }
  return (
    <>
      <div className="absolute top-1 left-1 right-1 h-[5px] pointer-events-none" style={beadH} aria-hidden />
      <div className="absolute bottom-1 left-1 right-1 h-[5px] pointer-events-none" style={beadH} aria-hidden />
      <div className="absolute top-1 bottom-1 left-1 w-[5px] pointer-events-none" style={beadV} aria-hidden />
      <div className="absolute top-1 bottom-1 right-1 w-[5px] pointer-events-none" style={beadV} aria-hidden />
    </>
  )
}

/**
 * Baroque ornamental corner. A symmetric curling-leaf shape rendered in
 * gold gradient, positioned just outside each frame corner so it visually
 * "breaks" the rectangle the way a real ornate frame's carvings do.
 */
function CornerOrnament({ corner }: { corner: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' }) {
  const pos = {
    'top-left':     '-top-3 -left-3 sm:-top-4 sm:-left-4',
    'top-right':    '-top-3 -right-3 sm:-top-4 sm:-right-4',
    'bottom-left':  '-bottom-3 -left-3 sm:-bottom-4 sm:-left-4',
    'bottom-right': '-bottom-3 -right-3 sm:-bottom-4 sm:-right-4',
  }[corner]
  const rotate = {
    'top-left':     0,
    'top-right':    90,
    'bottom-right': 180,
    'bottom-left':  270,
  }[corner]

  return (
    <svg
      width="40"
      height="40"
      viewBox="0 0 48 48"
      className={`absolute w-8 h-8 sm:w-12 sm:h-12 ${pos} pointer-events-none`}
      style={{ transform: `rotate(${rotate}deg)` }}
      aria-hidden
    >
      <defs>
        <linearGradient id={`corner-grad-${corner}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={GOLD_HIGHLIGHT} />
          <stop offset="55%" stopColor={GOLD_MID} />
          <stop offset="100%" stopColor={GOLD_DEEP} />
        </linearGradient>
      </defs>
      {/* Main curling-leaf shape */}
      <path
        d="M 6 6
           Q 22 6 30 14
           Q 38 22 42 38
           L 38 42
           Q 30 28 24 22
           Q 18 16 14 14
           Q 10 12 6 10 Z"
        fill={`url(#corner-grad-${corner})`}
        stroke={GOLD_DARKEST}
        strokeWidth="0.6"
        strokeLinejoin="round"
      />
      {/* Inner curl — secondary scroll for richer detail */}
      <path
        d="M 12 12
           Q 22 14 28 20
           Q 32 24 34 30"
        stroke={GOLD_DARKEST}
        strokeWidth="0.8"
        fill="none"
        opacity="0.55"
      />
      {/* Small accent dot */}
      <circle cx="14" cy="14" r="2" fill={GOLD_HIGHLIGHT} stroke={GOLD_DARKEST} strokeWidth="0.4" />
    </svg>
  )
}
