/**
 * Welcome page (the bare "/" route).
 *
 * Poster layout: the brand mark, tagline, headline and sub-copy are anchored
 * at the bottom-left over a warm, airy Red Centre wash, with the decorative
 * dotted flight-path arcing up across the page. Public route (no auth) so it
 * works as a marketing landing as well as a familiar home for returning
 * signed-in users.
 */

import Link from 'next/link'
import { User as UserIcon, Compass, Sparkles } from 'lucide-react'
import { ItineraBrand } from '@/components/ItineraBrand'

const ROUTE_OCHRE = '#D2A14C' // Desert ochre — start of the route line
const ROUTE_LINE = '#B5633C'  // Terracotta — decorative route line
const ROUTE_DOT = '#8F9A66'   // Spinifex sage — origin/destination dots

export default function WelcomePage() {
  return (
    <main
      className="relative min-h-screen overflow-hidden flex flex-col"
      style={{
        // Soft, airy wash within the palette — ochre glow top-right, a faint
        // spinifex-sage glow bottom-left (framing the poster copy), over a
        // warm white→sand gradient.
        background:
          'radial-gradient(70% 55% at 82% -5%, rgba(212,161,76,0.30) 0%, transparent 60%), ' +
          'radial-gradient(65% 60% at 4% 108%, rgba(143,154,102,0.20) 0%, transparent 60%), ' +
          'linear-gradient(180deg, #FCF7EF 0%, #F1E4D2 100%)',
      }}
    >
      {/* Decorative dotted flight-path arcing up across the page —
          a gradient ochre→terracotta line with glowing sage waypoints. */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox="0 0 1200 800"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden
      >
        <defs>
          <linearGradient id="routeGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={ROUTE_OCHRE} />
            <stop offset="100%" stopColor={ROUTE_LINE} />
          </linearGradient>
        </defs>
        <path
          d="M 80 620 Q 360 200 720 380 Q 980 480 1140 220"
          stroke="url(#routeGrad)"
          strokeWidth="2.5"
          strokeDasharray="3 12"
          strokeLinecap="round"
          opacity="0.5"
          fill="none"
        />
        {[
          [80, 620], [720, 380], [1140, 220],
        ].map(([cx, cy]) => (
          <g key={`${cx}-${cy}`}>
            <circle cx={cx} cy={cy} r="12" fill={ROUTE_DOT} opacity="0.16" />
            <circle cx={cx} cy={cy} r="5.5" fill={ROUTE_DOT} opacity="0.85" />
          </g>
        ))}
      </svg>

      {/* Top navigation — stacked section links, top-left. */}
      <header className="relative z-10 px-5 sm:px-10 py-5 sm:py-6">
        <nav className="flex flex-col items-start gap-2.5 text-[11px] sm:text-xs uppercase tracking-[0.22em] text-ink-muted">
          <Link href="/profile" className="hover:text-ink transition inline-flex items-center gap-1.5">
            <UserIcon className="w-3 h-3" />
            <span>My profile</span>
          </Link>
          <Link href="/inspiration" className="hover:text-ink transition inline-flex items-center gap-1.5">
            <Compass className="w-3 h-3" />
            <span>Travel inspiration</span>
          </Link>
          <Link href="/how-it-works" className="hover:text-ink transition inline-flex items-center gap-1.5">
            <Sparkles className="w-3 h-3" />
            <span>How it works</span>
          </Link>
        </nav>
      </header>

      {/* Poster hero — pushed to the bottom-left with mt-auto. */}
      <section className="relative z-10 mt-auto px-6 sm:px-10 pb-14 sm:pb-20 max-w-3xl">
        <ItineraBrand size="xl" />

        <p className="mt-6 sm:mt-7 text-[11px] sm:text-xs uppercase tracking-[0.32em] text-ink-muted">
          The art of the journey
        </p>

        <h1 className="h-display text-3xl sm:text-4xl md:text-5xl mt-5 sm:mt-6 max-w-2xl text-ink-soft">
          Every flight, hotel, and reservation, gathered into one considered itinerary.
        </h1>

        <p className="text-ink-muted mt-4 sm:mt-5 max-w-lg text-sm leading-relaxed">
          Forward your booking emails, or let Itinera plan the trip around who’s coming.
          Either way, your whole journey lands in one calm, shareable place.
        </p>
      </section>
    </main>
  )
}
