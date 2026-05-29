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
    body: 'Name where you’re going, when, and who’s coming — a couple, a family with young kids, four friends and their ages. That last detail shapes everything that follows.',
  },
  {
    title: 'Let Itinera plan it',
    body: 'Don’t fancy a blank page? Itinera suggests a day-by-day plan built around your group — an easy pace and kid-friendly stops for families, late dinners and slow mornings for couples — balancing the must-sees with room to breathe. Soon you’ll be able to book the whole thing through trusted travel partners without leaving the page.',
  },
  {
    title: 'Or forward what you’ve booked',
    body: 'Already sorted some of it? Forward flight, hotel, restaurant and tour confirmations to your trip’s private inbox address — attachments and PDFs included. Forwarding is all it takes.',
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
    title: 'Share with family and friends',
    body: 'Invite the people you’re travelling with. Everyone sees the same up-to-date itinerary — flights, hotels, plans and who’s paid — so nobody’s digging through a group chat for the address of tonight’s dinner.',
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
        <h1 className="h-display text-4xl sm:text-6xl mt-2">Plan it, or forward it.</h1>
        <p className="text-ink-muted mt-3 max-w-2xl text-sm sm:text-base leading-relaxed">
          Two ways to a finished trip: tell Itinera who’s coming and let it plan the days for
          you, or forward the bookings you’ve already made. Either way it all lands in one calm,
          shareable place — no spreadsheets, no copying details across by hand.
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
            Start with a plan, or start with your inbox.
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
