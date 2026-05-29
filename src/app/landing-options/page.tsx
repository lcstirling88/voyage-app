/**
 * Landing-page design explorer — a throwaway decision page (like /palettes).
 * Four directions for the front door ("/"), stacked and framed so they can
 * be compared in one scroll. All share the Red Centre palette and keep the
 * decorative "travel dots" route motif, featured differently in each.
 *
 * Public route (auth.ts only gates /trips). Once a direction is chosen it
 * gets promoted to src/app/page.tsx.
 */

import type { ReactNode } from 'react'
import Link from 'next/link'
import { ChevronLeft, User as UserIcon, Compass, Sparkles, ArrowRight } from 'lucide-react'
import { ItineraBrand } from '@/components/ItineraBrand'

const ROUTE_LINE = '#B5633C' // terracotta
const OCHRE = '#D2A14C'      // desert ochre
const ROUTE_DOT = '#8F9A66'  // spinifex sage

const TAGLINE = 'The art of the journey'
const HEADLINE = 'Every flight, hotel, and reservation, gathered into one considered itinerary.'
const SUBCOPY =
  'Forward your booking emails, or let Itinera plan the trip around who’s coming. Either way, your whole journey lands in one calm, shareable place.'

const NAV = [
  { href: '/profile', label: 'My profile', Icon: UserIcon },
  { href: '/inspiration', label: 'Travel inspiration', Icon: Compass },
  { href: '/how-it-works', label: 'How it works', Icon: Sparkles },
]

function NavLinks({ stacked = false, invert = false }: { stacked?: boolean; invert?: boolean }) {
  const link = invert ? 'text-white/75 hover:text-white' : 'text-ink-muted hover:text-ink'
  return (
    <nav
      className={`flex ${stacked ? 'flex-col items-start gap-2.5' : 'flex-wrap items-center gap-4 sm:gap-6'} text-[11px] sm:text-xs uppercase tracking-[0.22em]`}
    >
      {NAV.map(({ href, label, Icon }) => (
        <Link key={href} href={href} className={`${link} transition inline-flex items-center gap-1.5`}>
          <Icon className="w-3 h-3" />
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  )
}

function RouteArc({
  id, className, opacity = 0.45, strokeWidth = 2.5,
  lineFrom = OCHRE, lineTo = ROUTE_LINE, dot = ROUTE_DOT, dotCore = 0.85,
}: {
  id: string; className?: string; opacity?: number; strokeWidth?: number
  lineFrom?: string; lineTo?: string; dot?: string; dotCore?: number
}) {
  return (
    <svg className={className} viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={lineFrom} />
          <stop offset="100%" stopColor={lineTo} />
        </linearGradient>
      </defs>
      <path
        d="M 80 620 Q 360 200 720 380 Q 980 480 1140 220"
        stroke={`url(#${id})`}
        strokeWidth={strokeWidth}
        strokeDasharray="3 12"
        strokeLinecap="round"
        opacity={opacity}
        fill="none"
      />
      {([[80, 620], [720, 380], [1140, 220]] as const).map(([cx, cy]) => (
        <g key={`${cx}-${cy}`}>
          <circle cx={cx} cy={cy} r="12" fill={dot} opacity={0.15} />
          <circle cx={cx} cy={cy} r="5.5" fill={dot} opacity={dotCore} />
        </g>
      ))}
    </svg>
  )
}

const FRAME = 'relative min-h-[560px] sm:min-h-[640px] overflow-hidden'

/* A — Centered editorial: today's page, refined. Dots as a soft wash. */
function LandingCentered() {
  return (
    <div className={`${FRAME} hero-light`}>
      <RouteArc id="arc-a" className="absolute inset-0 w-full h-full pointer-events-none" opacity={0.4} />
      <div className="absolute top-0 left-0 px-6 sm:px-10 py-6 z-10">
        <NavLinks stacked />
      </div>
      <div className="relative z-10 flex flex-col items-center justify-center text-center min-h-[560px] sm:min-h-[640px] px-6 py-20">
        <ItineraBrand size="xl" />
        <p className="mt-6 text-[11px] uppercase tracking-[0.32em] text-ink-muted">{TAGLINE}</p>
        <h1 className="font-display text-2xl sm:text-3xl mt-7 max-w-xl leading-snug tracking-tight text-ink-soft">
          {HEADLINE}
        </h1>
        <p className="text-ink-muted mt-4 max-w-lg text-sm leading-relaxed">{SUBCOPY}</p>
      </div>
    </div>
  )
}

/* B — Magazine split: type left, route mapped large on a sand panel right. */
function LandingSplit() {
  return (
    <div className={`${FRAME} bg-paper-pure grid md:grid-cols-2`}>
      <div className="relative z-10 flex flex-col px-7 sm:px-10 py-8">
        <NavLinks />
        <div className="mt-auto pt-10">
          <ItineraBrand size="lg" />
          <p className="mt-5 text-[11px] uppercase tracking-[0.32em] text-ink-muted">{TAGLINE}</p>
          <h1 className="h-display text-3xl sm:text-4xl mt-5 max-w-md text-ink-soft">{HEADLINE}</h1>
          <p className="text-ink-muted mt-4 max-w-md text-sm leading-relaxed">{SUBCOPY}</p>
          <Link
            href="/how-it-works"
            className="mt-7 inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.22em] text-sage hover:text-sage-dark transition"
          >
            See how it works <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
      <div className="relative overflow-hidden bg-sage-soft min-h-[280px] md:min-h-0 border-t md:border-t-0 md:border-l border-line">
        <RouteArc id="arc-b" className="absolute inset-0 w-full h-full" opacity={0.75} strokeWidth={3} dotCore={0.95} />
        <div className="absolute bottom-5 right-6 text-[10px] uppercase tracking-[0.24em] text-ink-muted/70">
          Your route, mapped
        </div>
      </div>
    </div>
  )
}

/* C — Full-bleed desert poster: cream type over a warm dusk gradient. */
function LandingPoster() {
  return (
    <div
      className={FRAME}
      style={{
        background:
          'radial-gradient(120% 80% at 18% -5%, rgba(212,161,76,0.50) 0%, transparent 55%), ' +
          'linear-gradient(158deg, #3A2114 0%, #6E3A28 46%, #A8572F 100%)',
      }}
    >
      <RouteArc
        id="arc-c"
        className="absolute inset-0 w-full h-full"
        opacity={0.5}
        lineFrom="#F3E6CC"
        lineTo="#E8C9A0"
        dot="#F3E6CC"
        dotCore={0.9}
      />
      <div className="absolute top-0 left-0 right-0 px-7 sm:px-10 py-6 z-10">
        <NavLinks invert />
      </div>
      <div className="relative z-10 flex flex-col justify-end min-h-[560px] sm:min-h-[640px] px-7 sm:px-12 pb-12 pt-24">
        <ItineraBrand size="xl" invert />
        <p className="mt-5 text-[11px] uppercase tracking-[0.32em] text-white/70">{TAGLINE}</p>
        <h1 className="h-display text-4xl sm:text-5xl mt-5 max-w-2xl text-white">{HEADLINE}</h1>
        <p className="text-white/80 mt-4 max-w-lg text-sm leading-relaxed">{SUBCOPY}</p>
      </div>
    </div>
  )
}

/* D — Type-forward minimal: a huge Fraunces headline, dots barely there. */
function LandingMinimal() {
  return (
    <div className={`${FRAME} bg-paper`}>
      <RouteArc id="arc-d" className="absolute inset-0 w-full h-full pointer-events-none" opacity={0.16} strokeWidth={2} dotCore={0.4} />
      <div className="relative z-10 flex items-start justify-between gap-4 px-7 sm:px-10 py-6">
        <ItineraBrand size="sm" />
        <NavLinks />
      </div>
      <div className="relative z-10 px-7 sm:px-12 pt-12 sm:pt-20 pb-16 max-w-4xl">
        <h1 className="h-display text-5xl sm:text-7xl leading-[0.95] text-ink">
          The art of<br />the journey.
        </h1>
        <p className="text-ink-muted mt-8 max-w-md text-sm sm:text-base leading-relaxed">{SUBCOPY}</p>
      </div>
    </div>
  )
}

function OptionFrame({
  letter, name, note, children,
}: {
  letter: string; name: string; note: string; children: ReactNode
}) {
  return (
    <section className="mb-12 sm:mb-16">
      <div className="flex items-baseline gap-3 mb-3">
        <span className="font-display text-2xl text-sage leading-none">{letter}</span>
        <div className="min-w-0">
          <h2 className="font-display text-lg leading-tight">{name}</h2>
          <p className="text-xs text-ink-muted">{note}</p>
        </div>
      </div>
      <div className="rounded-2xl border border-line overflow-hidden shadow-soft">{children}</div>
    </section>
  )
}

export default function LandingOptionsPage() {
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

      <div className="max-w-5xl mx-auto px-5 sm:px-10 py-8 sm:py-12">
        <div className="text-[10px] uppercase tracking-[0.22em] text-ink-muted flex items-center gap-2">
          <Compass className="w-3 h-3" /> Landing page · directions
        </div>
        <h1 className="h-display text-4xl sm:text-6xl mt-2">Four front doors.</h1>
        <p className="text-ink-muted mt-3 max-w-2xl text-sm sm:text-base leading-relaxed">
          Four directions for the landing page — all in Red Centre, all keeping the travel dots
          (featured a little differently in each). Scroll through, then tell me which one — or a
          blend — to make the real front door.
        </p>

        <div className="mt-10 sm:mt-12">
          <OptionFrame
            letter="A"
            name="Centered editorial"
            note="Today’s page, refined — wordmark centred, the route dots a soft wash behind."
          >
            <LandingCentered />
          </OptionFrame>

          <OptionFrame
            letter="B"
            name="Magazine split"
            note="Type on the left; your route mapped large on a sand panel to the right."
          >
            <LandingSplit />
          </OptionFrame>

          <OptionFrame
            letter="C"
            name="Desert poster"
            note="Full-bleed warm dusk gradient with cream type — a real photograph could slot in here later."
          >
            <LandingPoster />
          </OptionFrame>

          <OptionFrame
            letter="D"
            name="Type-forward minimal"
            note="A huge Fraunces headline and lots of warm space; the dots barely there."
          >
            <LandingMinimal />
          </OptionFrame>
        </div>

        <div className="border-t border-line pt-8 text-center">
          <p className="text-xs text-ink-muted italic max-w-lg mx-auto">
            Previews are framed and a touch shorter than a real full screen. Pick a direction and
            I can fine-tune spacing, copy, and how prominent the dots are.
          </p>
        </div>
      </div>
    </main>
  )
}
