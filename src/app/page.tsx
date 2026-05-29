/**
 * Welcome page (the bare "/" route).
 *
 * First thing the user sees on opening the app — the brand mark, the tagline,
 * a CTA. Public route (no auth required) so it works as a marketing landing
 * as well as a familiar home for returning signed-in users; the CTA copy
 * adapts to auth state.
 */

import Link from 'next/link'
import { ArrowRight, Mail } from 'lucide-react'
import { auth, signIn } from '@/lib/auth'
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

      {/* Minimal header — just a sign-in link for returning travellers. */}
      <header className="relative z-10 flex items-center justify-end px-5 sm:px-10 py-5 sm:py-6">
        <Link href="/signin" className="text-[11px] sm:text-xs uppercase tracking-[0.22em] text-ink-muted hover:text-ink transition">
          Sign in
        </Link>
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

        {/* Sign-up space — passwordless: enter an email, get a magic link.
            The same flow signs returning users back in. */}
        <form
          action={async (formData) => {
            'use server'
            await signIn('resend', { email: formData.get('email'), redirectTo: '/' })
          }}
          className="mt-9 sm:mt-12 w-full max-w-md flex flex-col sm:flex-row items-stretch gap-2.5"
        >
          <input
            type="email"
            name="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            className="input flex-1 text-center sm:text-left"
          />
          <button type="submit" className="btn-ink justify-center whitespace-nowrap">
            <Mail className="w-4 h-4" /> Sign up
          </button>
        </form>
        <p className="mt-3 text-xs text-ink-muted">
          No password — we email you a magic link to begin.
        </p>

        <div className="mt-5 text-sm">
          {isAuthed ? (
            <Link href="/trips" className="text-ink-muted hover:text-ink ulink transition inline-flex items-center gap-1">
              Continue to your trips <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          ) : (
            <Link href="/inspiration" className="text-ink-muted hover:text-ink ulink transition">
              Browse inspiration first
            </Link>
          )}
        </div>
      </section>

      <footer className="relative z-10 px-6 sm:px-10 py-5 text-center text-[10px] uppercase tracking-[0.24em] text-ink-muted/60">
        Itinera · The art of the journey
      </footer>
    </main>
  )
}
