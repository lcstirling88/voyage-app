/**
 * Welcome page (the bare "/" route).
 *
 * First thing the user sees on opening the app — the brand mark, the tagline,
 * a CTA. Public route (no auth required) so it works as a marketing landing
 * as well as a familiar home for returning signed-in users; the CTA copy
 * adapts to auth state.
 */

import Link from 'next/link'
import { User as UserIcon, Compass, Sparkles } from 'lucide-react'
import { ItineraBrand } from '@/components/ItineraBrand'

const ROUTE_BLUE = '#0B6FB8'   // Spanish Blue — decorative route line
const ROUTE_CORAL = '#F08080'  // Light Coral — origin/destination dots

export default function WelcomePage() {
  return (
    <main
      className="relative min-h-screen overflow-hidden"
      style={{
        // Soft, airy wash within the palette — Uranium glow top-right,
        // a faint Coral glow bottom-left, over a white→mist gradient.
        background:
          'radial-gradient(70% 55% at 82% -5%, rgba(127,201,227,0.32) 0%, transparent 60%), ' +
          'radial-gradient(60% 55% at 8% 105%, rgba(240,128,128,0.16) 0%, transparent 60%), ' +
          'linear-gradient(180deg, #FFFFFF 0%, #E7F0FA 100%)',
      }}
    >
      {/* Decorative dotted flight-path arcing across the page — brighter now,
          a gradient Uranium→Spanish line with glowing coral waypoints. */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox="0 0 1200 800"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden
      >
        <defs>
          <linearGradient id="routeGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#7FC9E3" />
            <stop offset="100%" stopColor={ROUTE_BLUE} />
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
            <circle cx={cx} cy={cy} r="12" fill={ROUTE_CORAL} opacity="0.16" />
            <circle cx={cx} cy={cy} r="5.5" fill={ROUTE_CORAL} opacity="0.85" />
          </g>
        ))}
      </svg>

      {/* Top navigation — stacked section links. */}
      <header className="relative z-10 flex items-center px-5 sm:px-10 py-5 sm:py-6">
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

      {/* Hero — centred mark + tagline */}
      <section className="relative z-10 flex flex-col items-center justify-center text-center px-6 sm:px-10 pt-12 sm:pt-20 pb-16">
        <ItineraBrand size="xl" />

        <p className="mt-6 sm:mt-8 text-[11px] sm:text-xs uppercase tracking-[0.32em] text-ink-muted">
          The art of the journey
        </p>

        <h1 className="font-display text-xl sm:text-2xl md:text-3xl mt-7 sm:mt-9 max-w-xl leading-snug tracking-tight text-ink-soft">
          Every flight, hotel, and reservation,
          <br className="hidden sm:block" />
          gathered into one considered itinerary.
        </h1>

        <p className="text-ink-muted mt-4 sm:mt-5 max-w-lg text-sm leading-relaxed">
          Forward your booking emails. Itinera files them, builds your day-by-day,
          and keeps every passport stamp on a quiet, beautiful atlas of your travels.
        </p>
      </section>

      <footer className="relative z-10 px-6 sm:px-10 py-5 text-center text-[10px] uppercase tracking-[0.24em] text-ink-muted/60">
        Itinera · The art of the journey
      </footer>
    </main>
  )
}
