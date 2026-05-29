import { notFound } from 'next/navigation'
import { Sparkles, Paperclip, ArrowUp } from 'lucide-react'
import { prisma } from '@/lib/db'

export default async function AssistantPage({ params }: { params: Promise<{ tripSlug: string }> }) {
  const { tripSlug } = await params
  const trip = await prisma.trip.findUnique({
    where: { slug: tripSlug },
    include: { bookings: { orderBy: { startAt: 'asc' } } },
  })
  if (!trip) notFound()

  // Detect simple "gaps": days with no dinner booked.
  const dayBuckets = new Map<string, typeof trip.bookings>()
  for (const b of trip.bookings) {
    const key = b.startAt.toISOString().slice(0, 10)
    if (!dayBuckets.has(key)) dayBuckets.set(key, [])
    dayBuckets.get(key)!.push(b)
  }

  const gaps: { dateLabel: string; issue: string }[] = []
  const start = new Date(trip.startDate)
  for (let i = 0; i < 10; i++) {
    const d = new Date(start.getTime() + i * 86400000)
    const key = d.toISOString().slice(0, 10)
    const days = dayBuckets.get(key) ?? []
    const hasDinner = days.some((b) => b.type === 'restaurant' && b.startAt.getUTCHours() >= 17)
    if (!hasDinner && i < 8) {
      gaps.push({ dateLabel: `Day ${i + 1} · ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`, issue: 'No dinner booked' })
    }
    if (gaps.length >= 3) break
  }

  // Destination-aware suggested questions (no hardcoded place names).
  const place = trip.destination
  const suggestions = [
    `Where should I eat near my hotel in ${place}?`,
    `What's the best way to get around in ${place}?`,
    'Plan a half-day for a free afternoon',
    'What should I pack for the weather?',
  ]

  return (
    <>
      <div className="hero-light border-b border-line px-6 sm:px-10 py-8 sm:py-10">
        <div className="text-[10px] uppercase tracking-[0.22em] text-ink-muted">Itinera assistant</div>
        <h1 className="h-display text-4xl sm:text-6xl mt-2">Fill the gaps.</h1>
        <p className="text-ink-muted mt-3 max-w-xl text-sm sm:text-base">
          I&apos;ve read your whole itinerary. Ask me anything — or take a suggestion.
        </p>
      </div>

      <div className="px-6 sm:px-10 py-8 sm:py-10 max-w-5xl grid grid-cols-1 lg:grid-cols-4 gap-6 sm:gap-8">
        <aside className="lg:col-span-1 space-y-3">
          <div className="text-[10px] uppercase tracking-[0.18em] text-ink-muted px-1">Gaps I noticed</div>
          {gaps.map((g) => (
            <button key={g.dateLabel} className="w-full text-left border border-line rounded-lg p-3 bg-paper-pure hover:shadow-soft transition">
              <div className="text-xs text-rust">{g.dateLabel}</div>
              <div className="text-sm font-medium mt-0.5">{g.issue}</div>
            </button>
          ))}
          {gaps.length === 0 && <div className="text-sm text-ink-muted px-1">No gaps detected — nice job.</div>}

          <div className="text-[10px] uppercase tracking-[0.18em] text-ink-muted px-1 pt-4">Try asking</div>
          {suggestions.map((q) => (
            <button key={q} className="w-full text-left text-xs px-3 py-2 border border-line rounded-md hover:bg-line-soft text-ink-muted">{q}</button>
          ))}
        </aside>

        <div className="lg:col-span-3 border border-line rounded-xl bg-paper-pure flex flex-col h-[520px] sm:h-[600px]">
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
            <div className="flex gap-3 max-w-xl">
              <div className="w-8 h-8 rounded-full bg-sage grid place-items-center shrink-0">
                <Sparkles className="w-4 h-4 text-paper-pure" />
              </div>
              <div className="chat-bubble-ai rounded-2xl rounded-tl-sm px-4 py-3">
                <p className="text-sm">
                  Hi! I&apos;ve had a look through your <em>{trip.name}</em> trip
                  {trip.destination ? ` to ${trip.destination}` : ''}.{' '}
                  {gaps.length > 0
                    ? `${gaps.length} small thing${gaps.length === 1 ? '' : 's'} worth tightening up — want me to start with ${gaps[0].dateLabel.split(' · ')[1]} dinner?`
                    : 'Looking great — nothing to flag right now. Ask me anything below.'}
                </p>
              </div>
            </div>

            <div className="grid place-items-center flex-1 py-10 text-center">
              <div className="max-w-sm">
                <Sparkles className="w-6 h-6 text-sage mx-auto mb-3" />
                <p className="text-sm text-ink-muted">
                  Live chat with Claude is coming in the next iteration. For now, forward an email
                  like <span className="text-ink">&quot;help me plan a dinner&quot;</span> to your trip
                  inbox and the parser will turn it into suggestions on your itinerary.
                </p>
              </div>
            </div>
          </div>

          <div className="border-t border-line p-4 flex items-center gap-3">
            <button className="text-ink-muted hover:text-ink" aria-label="Attach"><Paperclip className="w-4 h-4" /></button>
            <input type="text" placeholder="Ask Itinera anything about this trip…" className="flex-1 bg-transparent outline-none text-sm placeholder:text-ink-muted" />
            <span className="text-[10px] text-ink-muted num-mono hidden md:inline">⌘ K</span>
            <button className="w-9 h-9 rounded-full bg-ink text-paper-pure grid place-items-center" aria-label="Send"><ArrowUp className="w-4 h-4" /></button>
          </div>
        </div>
      </div>
    </>
  )
}
