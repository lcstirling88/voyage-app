/**
 * The empty itinerary — the most important screen in the app. A trip with no
 * route and no bookings yet presents two clear "doors": let Itinera plan it
 * from nothing (→ the route planner), or bring an existing booking in by
 * forwarding confirmation emails (→ the inbox). Server component (just links).
 */

import Link from 'next/link'
import { Sparkles, Mail, ArrowRight } from 'lucide-react'

export function EmptyTripDoors({ tripSlug, destination }: { tripSlug: string; destination: string }) {
  return (
    <div className="px-5 sm:px-10 py-10 sm:py-16 max-w-4xl">
      <div className="text-[10px] uppercase tracking-[0.22em] text-ink-muted">A blank page</div>
      <h2 className="h-display text-3xl sm:text-4xl mt-2 leading-tight">
        Let&rsquo;s build your {destination} trip
      </h2>
      <p className="text-ink-muted mt-3 max-w-xl text-sm sm:text-base leading-relaxed">
        Two ways in. Start from scratch and let Itinera shape it with you, or bring what you&rsquo;ve already
        booked — you can mix both, any time.
      </p>

      <div className="grid sm:grid-cols-2 gap-4 sm:gap-5 mt-7 sm:mt-9">
        {/* Door 1 — plan from nothing */}
        <Link
          href={`/trips/${tripSlug}/plan`}
          className="group relative flex flex-col rounded-2xl border border-line bg-paper-pure p-6 sm:p-7 hover:border-sage hover:shadow-[0_8px_30px_-12px_rgba(51,36,27,0.18)] transition"
        >
          <span className="w-11 h-11 rounded-full bg-sage-soft grid place-items-center text-sage-dark">
            <Sparkles className="w-5 h-5" />
          </span>
          <h3 className="h-display text-2xl sm:text-[1.7rem] mt-5 leading-tight">Help me plan it</h3>
          <p className="text-sm text-ink-muted mt-2 leading-relaxed flex-1">
            Start from a blank map. Itinera proposes a route — which cities, in what order, for how many
            nights — then fills your days with ideas that flow.
          </p>
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-sage-dark mt-5 group-hover:gap-2.5 transition-all">
            Shape the route <ArrowRight className="w-4 h-4" />
          </span>
        </Link>

        {/* Door 2 — already booked */}
        <Link
          href={`/trips/${tripSlug}/inbox`}
          className="group relative flex flex-col rounded-2xl border border-line bg-paper-pure p-6 sm:p-7 hover:border-sage hover:shadow-[0_8px_30px_-12px_rgba(51,36,27,0.18)] transition"
        >
          <span className="w-11 h-11 rounded-full bg-paper grid place-items-center text-ink-soft">
            <Mail className="w-5 h-5" />
          </span>
          <h3 className="h-display text-2xl sm:text-[1.7rem] mt-5 leading-tight">I&rsquo;ve already booked</h3>
          <p className="text-sm text-ink-muted mt-2 leading-relaxed flex-1">
            Forward your confirmation emails — flights, hotels, tours — and Itinera reads them into a clean
            day-by-day itinerary automatically.
          </p>
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-sage-dark mt-5 group-hover:gap-2.5 transition-all">
            Forward an email <ArrowRight className="w-4 h-4" />
          </span>
        </Link>
      </div>
    </div>
  )
}
