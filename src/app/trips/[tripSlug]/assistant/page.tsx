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

  // Detect simple "gaps": days with no booking, evenings with no restaurant
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

  return (
    <>
      <div className="hero-light border-b border-line px-10 py-10">
        <div className="text-[10px] uppercase tracking-[0.22em] text-ink-muted">Voyage assistant</div>
        <h1 className="h-display text-6xl mt-2">Fill the gaps.</h1>
        <p className="text-ink-muted mt-3 max-w-xl">
          I&apos;ve read your whole itinerary. Ask me anything — or take a suggestion.
        </p>
      </div>

      <div className="px-10 py-10 max-w-5xl grid grid-cols-4 gap-8">
        <aside className="col-span-1 space-y-3">
          <div className="text-[10px] uppercase tracking-[0.18em] text-ink-muted px-1">Gaps I noticed</div>
          {gaps.map((g) => (
            <button key={g.dateLabel} className="w-full text-left border border-line rounded-lg p-3 bg-paper-pure hover:shadow-soft transition">
              <div className="text-xs text-rust">{g.dateLabel}</div>
              <div className="text-sm font-medium mt-0.5">{g.issue}</div>
            </button>
          ))}
          {gaps.length === 0 && <div className="text-sm text-ink-muted px-1">No gaps detected — nice job.</div>}

          <div className="text-[10px] uppercase tracking-[0.18em] text-ink-muted px-1 pt-4">Try asking</div>
          {[
            'Where should I get coffee in Arashiyama?',
            'How do I get from Hakone to Kyoto?',
            "What's a good gift to bring back?",
          ].map((q) => (
            <button key={q} className="w-full text-left text-xs px-3 py-2 border border-line rounded-md hover:bg-line-soft text-ink-muted">{q}</button>
          ))}
        </aside>

        <div className="lg:col-span-3 border border-line rounded-xl bg-paper-pure flex flex-col h-[560px] sm:h-[640px]">
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            <div className="flex gap-3 max-w-xl">
              <div className="w-8 h-8 rounded-full bg-sage grid place-items-center shrink-0">
                <Sparkles className="w-4 h-4 text-paper-pure" />
              </div>
              <div className="chat-bubble-ai rounded-2xl rounded-tl-sm px-4 py-3">
                <p className="text-sm">
                  Morning! I had a look through your <em>{trip.name}</em> trip. {gaps.length > 0 ? `${gaps.length} small things worth tightening up — want me to walk through them, or shall we tackle ${gaps[0].dateLabel.split(' · ')[1]} dinner first?` : 'Looking great — nothing to flag right now.'}
                </p>
              </div>
            </div>

            <div className="flex gap-3 max-w-xl ml-auto justify-end">
              <div className="chat-bubble-user rounded-2xl rounded-tr-sm px-4 py-3">
                <p className="text-sm">Suggest somewhere memorable but not too fussy. Walking distance from Hoshinoya ideally.</p>
              </div>
            </div>

            <div className="flex gap-3 max-w-2xl">
              <div className="w-8 h-8 rounded-full bg-sage grid place-items-center shrink-0">
                <Sparkles className="w-4 h-4 text-paper-pure" />
              </div>
              <div className="chat-bubble-ai rounded-2xl rounded-tl-sm px-4 py-3">
                <p className="text-sm">Good brief. Hoshinoya is in Arashiyama, so you&apos;ve got two directions:</p>
                <div className="mt-3 space-y-2">
                  <div className="border border-line rounded-lg p-3 hover:bg-line-soft cursor-pointer">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-medium text-sm">Yoshimura Arashiyama</div>
                        <div className="text-xs text-ink-muted mt-0.5">5min walk · ¥4,500pp</div>
                      </div>
                      <span className="pill pill-paid text-[9px]">my pick</span>
                    </div>
                    <p className="text-xs text-ink-muted mt-2">Traditional soba in a wooden building overlooking the Hozu River. Quiet after the day-trippers leave. Walk-ins after 19:00.</p>
                  </div>
                  <div className="border border-line rounded-lg p-3 hover:bg-line-soft cursor-pointer">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-medium text-sm">Giro Giro Hitoshina</div>
                        <div className="text-xs text-ink-muted mt-0.5">Gion · 30min · ¥12,000pp</div>
                      </div>
                    </div>
                    <p className="text-xs text-ink-muted mt-2">Casual kaiseki — counter, 9 courses, no fuss. Books 3 weeks ahead.</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <button className="text-xs px-3 py-1.5 rounded-md bg-ink text-paper-pure">Add Yoshimura</button>
                  <button className="text-xs px-3 py-1.5 rounded-md border border-line">More options</button>
                </div>
              </div>
            </div>

            <div className="text-xs text-ink-muted text-center pt-4">
              Live chat with Claude coming next iteration — for now, ask via the inbox: forward an email like &quot;help me plan dinner for Oct 16&quot; and the parser will turn that into a thread.
            </div>
          </div>

          <div className="border-t border-line p-4 flex items-center gap-3">
            <button className="text-ink-muted hover:text-ink"><Paperclip className="w-4 h-4" /></button>
            <input type="text" placeholder="Ask Voyage anything about this trip…" className="flex-1 bg-transparent outline-none text-sm placeholder:text-ink-muted" />
            <span className="text-[10px] text-ink-muted num-mono hidden md:inline">⌘ K</span>
            <button className="w-9 h-9 rounded-full bg-ink text-paper-pure grid place-items-center"><ArrowUp className="w-4 h-4" /></button>
          </div>
        </div>
      </div>
    </>
  )
}
