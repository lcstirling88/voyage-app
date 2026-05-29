/**
 * How Itinera works — a public, account-free explainer of the core flow:
 * start a trip, forward your booking emails, and Itinera files everything
 * into one calm day-by-day companion (plus an atlas of where you've been).
 *
 * Public route (auth.ts only gates /trips), so it doubles as marketing.
 */

import Link from 'next/link'
import { ChevronLeft, Sparkles, ArrowRight } from 'lucide-react'
import { ItineraBrand } from '@/components/ItineraBrand'

const STEPS: { title: string; body: string }[] = [
  {
    title: 'Start a trip',
    body: 'Name where you’re going and when. Itinera sets up the itinerary, the local clock, the currency and a first weather outlook before you’ve even booked.',
  },
  {
    title: 'Forward your bookings',
    body: 'Send flight, hotel, restaurant and tour confirmations to your trip’s private inbox address — attachments and PDFs included. Forwarding is all it takes.',
  },
  {
    title: 'We read and file everything',
    body: 'Itinera reads each email, drops it onto the right day and time, stores the PDFs in Documents, and keeps a running tally of what’s paid and what’s still owing.',
  },
  {
    title: 'Everything in one calm place',
    body: 'Your day-by-day itinerary, historical weather and what to pack, local info and visa notes, costs and documents — one considered page that installs as an app and works on the move.',
  },
  {
    title: 'Collect the world',
    body: 'Every finished trip paints itself onto your personal atlas. Watch your passport fill, one country at a time.',
  },
]

export default function HowItWorksPage() {
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

      <div className="max-w-3xl mx-auto px-5 sm:px-10 py-8 sm:py-12">
        <div className="text-[10px] uppercase tracking-[0.22em] text-ink-muted flex items-center gap-2">
          <Sparkles className="w-3 h-3" /> How it works
        </div>
        <h1 className="h-display text-4xl sm:text-6xl mt-2">From inbox to itinerary.</h1>
        <p className="text-ink-muted mt-3 max-w-2xl text-sm sm:text-base leading-relaxed">
          Itinera turns the booking confirmations already landing in your inbox into a calm,
          complete travel companion — no spreadsheets, no copying details across by hand.
          Here’s the whole of it.
        </p>

        <ol className="mt-10 sm:mt-12">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex gap-5 sm:gap-8 py-6 sm:py-7 border-t border-line">
              <span className="font-display text-3xl sm:text-4xl text-sage/70 leading-none shrink-0">
                {String(i + 1).padStart(2, '0')}
              </span>
              <div className="min-w-0">
                <h2 className="font-display text-xl sm:text-2xl">{s.title}</h2>
                <p className="text-ink-muted mt-1.5 sm:mt-2 text-sm sm:text-base leading-relaxed">
                  {s.body}
                </p>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-12 sm:mt-16 border-t border-line pt-8 text-center">
          <p className="font-display italic text-lg sm:text-xl text-ink-soft max-w-lg mx-auto">
            Forward one booking and watch it appear.
          </p>
          <Link
            href="/inspiration"
            className="mt-4 inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.22em] text-ink-muted hover:text-ink transition"
          >
            Find somewhere to go <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>
    </main>
  )
}
