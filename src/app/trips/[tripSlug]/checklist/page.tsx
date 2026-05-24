import { notFound } from 'next/navigation'
import { CheckCircle2, CircleDashed, Circle, Sparkles } from 'lucide-react'
import { format, subDays, subMonths } from 'date-fns'
import { prisma } from '@/lib/db'
import { ChecklistCheckbox } from '@/components/ChecklistCheckbox'

function sectionMeta(sectionKey: string, tripStart: Date): { title: string; subtitle: string } {
  switch (sectionKey) {
    case '3mo':
      return {
        title:    `3 months out · ${format(subMonths(tripStart, 3), 'MMM')}`,
        subtitle: 'Book the big-ticket items — accommodation, flights, signature meals',
      }
    case '1mo':
      return {
        title:    `1 month out · ${format(subMonths(tripStart, 1), 'MMM')}`,
        subtitle: 'Insurance, eSIM, currency, final balances',
      }
    case '1wk':
      return {
        title:    `1 week out · ${format(subDays(tripStart, 7), 'MMM d')}`,
        subtitle: 'Pack, print, prep the house',
      }
    case 'day_of':
      return {
        title:    `Day of departure · ${format(tripStart, 'MMM d')}`,
        subtitle: 'Final walkthrough',
      }
    default:
      return { title: sectionKey, subtitle: '' }
  }
}

export default async function ChecklistPage({ params }: { params: Promise<{ tripSlug: string }> }) {
  const { tripSlug } = await params
  const trip = await prisma.trip.findUnique({
    where: { slug: tripSlug },
    include: { checklistItems: { orderBy: [{ section: 'asc' }, { position: 'asc' }] } },
  })
  if (!trip) notFound()

  const bySection = trip.checklistItems.reduce((acc, item) => {
    if (!acc[item.section]) acc[item.section] = []
    acc[item.section].push(item)
    return acc
  }, {} as Record<string, typeof trip.checklistItems>)

  const preTrip = ['3mo', '1mo', '1wk', 'day_of']
  const packing = bySection.packing ?? []
  const packingByCat = packing.reduce((acc, item) => {
    const cat = item.category ?? 'misc'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(item)
    return acc
  }, {} as Record<string, typeof packing>)

  return (
    <>
      <div className="hero-light border-b border-line px-10 py-10">
        <div className="text-[10px] uppercase tracking-[0.22em] text-ink-muted">Checklist</div>
        <h1 className="h-display text-6xl mt-2">Don&apos;t forget.</h1>
      </div>

      <div className="px-10 py-10 max-w-7xl grid grid-cols-3 gap-8">
        <div className="col-span-2 space-y-6">
          <section>
            <h2 className="font-display text-2xl mb-4">Pre-trip · by date</h2>
            <div className="border border-line rounded-xl bg-paper-pure overflow-hidden divide-y divide-line">
              {preTrip.map((sectionKey) => {
                const items = bySection[sectionKey] ?? []
                if (items.length === 0) return null
                const doneCount = items.filter((i) => i.done).length
                const isComplete = doneCount === items.length
                const inProgress = doneCount > 0 && doneCount < items.length
                const meta = sectionMeta(sectionKey, trip.startDate)
                return (
                  <details key={sectionKey} open={!isComplete}>
                    <summary className="px-5 py-4 flex items-center gap-4 cursor-pointer hover:bg-line-soft/40">
                      {isComplete ? <CheckCircle2 className="w-5 h-5 text-sage" />
                        : inProgress ? <CircleDashed className="w-5 h-5 text-gold" />
                        : <Circle className="w-5 h-5 text-ink-muted" />}
                      <div className="flex-1">
                        <div className="font-medium">{meta.title}</div>
                        <div className="text-xs text-ink-muted">{meta.subtitle}</div>
                      </div>
                      <span className={`pill ${isComplete ? 'pill-paid' : 'pill-upcoming'}`}>{doneCount}/{items.length} done</span>
                    </summary>
                    <div className="px-12 py-3 space-y-2">
                      {items.map((item) => (
                        <ChecklistCheckbox key={item.id} id={item.id} done={item.done} label={item.text} />
                      ))}
                    </div>
                  </details>
                )
              })}
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="border border-line rounded-xl bg-paper-pure p-5">
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="font-display text-2xl">Packing</h2>
              <span className="text-xs text-ink-muted num-mono">{packing.filter((i) => i.done).length} / {packing.length}</span>
            </div>
            <div className="space-y-4">
              {Object.entries(packingByCat).map(([cat, items]) => (
                <div key={cat}>
                  <div className="text-[10px] uppercase tracking-[0.18em] text-ink-muted mb-2">{cat}</div>
                  {items.map((item) => (
                    <ChecklistCheckbox key={item.id} id={item.id} done={item.done} label={item.text} />
                  ))}
                </div>
              ))}
            </div>
          </section>

          <section className="border border-line rounded-xl bg-sakura-soft p-5">
            <div className="flex items-center gap-2 text-wine text-xs uppercase tracking-[0.18em] mb-3">
              <Sparkles className="w-4 h-4" /> Voyage suggests
            </div>
            <p className="text-sm">You&apos;re going to walk a lot — travellers average <strong>22,000 steps/day</strong> in Kyoto. Worth adding insoles or a second pair of shoes.</p>
          </section>
        </div>
      </div>
    </>
  )
}
