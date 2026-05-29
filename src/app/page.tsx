/**
 * Welcome page (the bare "/" route).
 *
 * Split poster: the LEFT half carries the brand mark, tagline, headline,
 * sub-copy and a primary CTA over a warm Red Centre wash with the dotted
 * route motif; the RIGHT half is a daily-rotating inspiration photograph
 * (a different, deliberately lesser-known place each day) with a "what +
 * where" caption. Public route (no auth) — marketing landing and a familiar
 * home for returning users.
 */

import Link from 'next/link'
import { User as UserIcon, Compass, Sparkles, ArrowRight } from 'lucide-react'
import { ItineraBrand } from '@/components/ItineraBrand'
import { photoOfTheDay } from '@/lib/landing-photos'
import { LandingPhotoClient } from '@/components/LandingPhotoClient'

// Re-render periodically so the photo-of-the-day advances at midnight without
// needing a redeploy (the page is otherwise static).
export const revalidate = 1800

const ROUTE_OCHRE = '#D2A14C' // Desert ochre — start of the route line
const ROUTE_LINE = '#B5633C'  // Terracotta — decorative route line
const ROUTE_DOT = '#8F9A66'   // Spinifex sage — origin/destination dots

export default function WelcomePage() {
  const photo = photoOfTheDay()

  return (
    <main
      className="relative min-h-dvh md:grid md:grid-cols-[2fr_1fr]"
      style={{
        // Warm wash spans the whole page so the framed photo on the right
        // floats on the same surface as the content (no hard column seam).
        background:
          'radial-gradient(45% 45% at 0% 100%, rgba(143,154,102,0.20) 0%, transparent 60%), ' +
          'radial-gradient(48% 42% at 58% 0%, rgba(212,161,76,0.24) 0%, transparent 60%), ' +
          'linear-gradient(180deg, #FCF7EF 0%, #F1E4D2 100%)',
      }}
    >
      {/* LEFT — brand poster over a warm wash + dotted route. */}
      <div className="relative overflow-hidden flex flex-col min-h-[58dvh] md:min-h-dvh">
        {/* Decorative dotted flight-path — ochre→terracotta line, sage dots. */}
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
            d="M 52 655 Q 360 200 720 380 Q 980 480 1140 220"
            stroke="url(#routeGrad)"
            strokeWidth="2.5"
            strokeDasharray="3 12"
            strokeLinecap="round"
            opacity="0.5"
            fill="none"
          />
          {[
            [52, 655], [720, 380], [1140, 220],
          ].map(([cx, cy]) => (
            <g key={`${cx}-${cy}`}>
              <circle cx={cx} cy={cy} r="12" fill={ROUTE_DOT} opacity="0.16" />
              <circle cx={cx} cy={cy} r="5.5" fill={ROUTE_DOT} opacity="0.85" />
            </g>
          ))}
          {/* Little plane on final approach — on the upward climb of the
              second curve toward the top-right destination (by the photo). */}
          <path
            d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"
            transform="translate(965 339) scale(2.6)"
            fill={ROUTE_LINE}
            opacity="0.92"
          />
        </svg>

        {/* Top navigation — stacked section links. */}
        <header className="relative z-10 px-5 sm:px-10 pt-[calc(env(safe-area-inset-top)+1.25rem)] pb-5 sm:pt-[calc(env(safe-area-inset-top)+1.5rem)] sm:pb-6">
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

        {/* Poster hero — anchored to the bottom-left. */}
        <section className="relative z-10 mt-auto px-6 sm:px-10 pb-12 sm:pb-16 max-w-2xl">
          <ItineraBrand size="xl" />

          <p className="mt-6 sm:mt-7 text-[11px] sm:text-xs uppercase tracking-[0.32em] text-ink-muted">
            The art of the journey
          </p>

          <h1 className="h-display text-3xl sm:text-4xl mt-5 max-w-xl text-ink-soft">
            Every flight, hotel, and reservation, gathered into one considered itinerary.
          </h1>

          <p className="text-ink-muted mt-4 max-w-md text-sm leading-relaxed">
            Forward your booking emails, or let Itinera plan the trip around who’s coming.
            Either way, your whole journey lands in one calm, shareable place.
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-3">
            <Link
              href="/trips/new"
              className="inline-flex items-center gap-2 rounded-full bg-sage text-paper-pure px-5 py-2.5 text-sm font-medium hover:bg-sage-dark transition"
            >
              Plan a trip <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/how-it-works"
              className="text-xs uppercase tracking-[0.22em] text-ink-muted hover:text-ink transition"
            >
              See how it works
            </Link>
          </div>
        </section>
      </div>

      {/* RIGHT — daily inspiration photograph with a "what + where" caption. */}
      <LandingPhotoClient photo={photo} />
    </main>
  )
}
