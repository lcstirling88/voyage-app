/**
 * Welcome page (the bare "/" route).
 *
 * First thing the user sees on opening the app — the brand mark, the tagline,
 * a CTA. Public route (no auth required) so it works as a marketing landing
 * as well as a familiar home for returning signed-in users; the CTA copy
 * adapts to auth state.
 */

import Link from 'next/link'
import { ArrowRight, User as UserIcon, Compass } from 'lucide-react'
import { auth } from '@/lib/auth'
import { ItineraBrand } from '@/components/ItineraBrand'

const ROUTE_BLUE = '#0B6FB8'   // Spanish Blue — decorative route line
const ROUTE_CORAL = '#F08080'  // Light Coral — origin/destination dots

export default async function WelcomePage() {
  const session = await auth()
  const isAuthed = !!session?.user

  return (
    <main className="relative min-h-screen overflow-hidden bg-paper-pure">
      {/* Decorative dotted-route SVG in the background — very faint terracotta,
          evokes the brand mark (origin → destination arc) without distracting
          from the centred hero. */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox="0 0 1200 800"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden
      >
        <path
          d="M 80 620 Q 360 200 720 380 Q 980 480 1140 220"
          stroke={ROUTE_BLUE}
          strokeWidth="1.5"
          strokeDasharray="4 10"
          opacity="0.20"
          fill="none"
        />
        <circle cx="80" cy="620" r="5" fill={ROUTE_CORAL} opacity="0.4" />
        <circle cx="720" cy="380" r="5" fill={ROUTE_CORAL} opacity="0.4" />
        <circle cx="1140" cy="220" r="5" fill={ROUTE_CORAL} opacity="0.4" />
      </svg>

      {/* Top navigation. Left: section links the user asked for. Right: auth state. */}
      <header className="relative z-10 flex items-center justify-between px-5 sm:px-10 py-5 sm:py-6">
        <nav className="flex items-center gap-4 sm:gap-6 text-[11px] sm:text-xs uppercase tracking-[0.22em] text-ink-muted">
          <Link href="/profile" className="hover:text-ink transition inline-flex items-center gap-1.5">
            <UserIcon className="w-3 h-3" />
            <span>My profile</span>
          </Link>
          <Link href="/inspiration" className="hover:text-ink transition inline-flex items-center gap-1.5">
            <Compass className="w-3 h-3" />
            <span>Travel inspiration</span>
          </Link>
        </nav>
        <div className="text-[11px] sm:text-xs uppercase tracking-[0.22em] text-ink-muted">
          {isAuthed ? (
            <Link href="/trips" className="hover:text-ink transition">My trips</Link>
          ) : (
            <Link href="/signin" className="hover:text-ink transition">Sign in</Link>
          )}
        </div>
      </header>

      {/* Hero — centred mark + tagline */}
      <section className="relative z-10 flex flex-col items-center justify-center text-center px-6 sm:px-10 pt-12 sm:pt-20 pb-16">
        <ItineraBrand size="xl" />

        <p className="mt-6 sm:mt-8 text-[11px] sm:text-xs uppercase tracking-[0.32em] text-ink-muted">
          The art of the journey
        </p>

        <h1 className="font-display text-3xl sm:text-5xl mt-8 sm:mt-10 max-w-2xl leading-tight tracking-tight">
          Every flight, hotel, and reservation,
          <br className="hidden sm:block" />
          gathered into one considered itinerary.
        </h1>

        <p className="text-ink-muted mt-5 sm:mt-6 max-w-xl text-sm sm:text-base leading-relaxed">
          Forward your booking emails. Itinera files them, builds your day-by-day,
          and keeps every passport stamp on a quiet, beautiful atlas of your travels.
        </p>

        <div className="mt-9 sm:mt-12 flex flex-col sm:flex-row items-center gap-3 sm:gap-4">
          <Link
            href={isAuthed ? '/trips' : '/signin'}
            className="inline-flex items-center justify-center gap-2 text-sm font-medium px-6 py-3 rounded-md bg-sage text-paper-pure hover:opacity-90 transition shadow-soft"
          >
            {isAuthed ? 'Continue to your trips' : 'Begin your atlas'}
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/inspiration"
            className="text-sm text-ink-muted hover:text-ink ulink transition"
          >
            Browse inspiration first
          </Link>
        </div>
      </section>

      <footer className="relative z-10 px-6 sm:px-10 py-5 text-center text-[10px] uppercase tracking-[0.24em] text-ink-muted/60">
        Itinera · The art of the journey
      </footer>
    </main>
  )
}
