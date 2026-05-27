import { notFound } from 'next/navigation'
import { FileText, Plane, Bed, Ticket, Train, Utensils, Upload } from 'lucide-react'
import { prisma } from '@/lib/db'
import { InlineDeleteButton } from '@/components/InlineDeleteButton'

const inboxDomain = process.env.NEXT_PUBLIC_INBOX_DOMAIN ?? 'voyage.local'

const categoryIcon = (cat: string) => {
  if (cat === 'passport' || cat === 'visa' || cat === 'insurance') return FileText
  if (cat === 'ticket') return Ticket
  if (cat === 'voucher') return Bed
  return FileText
}

const categoryImg = (title: string, cat: string) => {
  const t = title.toLowerCase()
  if (t.includes('qantas') || t.includes('flight')) return 'img-flight'
  if (t.includes('hoshinoya') || t.includes('ryokan') || t.includes('kyoto')) return 'img-kyoto-ryokan'
  if (t.includes('gora') || t.includes('hakone')) return 'img-hakone'
  if (t.includes('edition') || t.includes('hotel') || t.includes('niwa')) return 'img-tokyo-hotel'
  if (t.includes('teamlab')) return 'img-teamlab'
  if (t.includes('tsukiji')) return 'img-tsukiji'
  if (t.includes('jr pass') || t.includes('rail')) return 'img-shibuya'
  if (t.includes('den')) return 'img-restaurant'
  if (cat === 'passport' || cat === 'visa') return 'img-ginza'
  return 'img-activity'
}

export default async function DocumentsPage({ params }: { params: Promise<{ tripSlug: string }> }) {
  const { tripSlug } = await params
  const trip = await prisma.trip.findUnique({
    where: { slug: tripSlug },
    include: { documents: { orderBy: { createdAt: 'asc' } } },
  })
  if (!trip) notFound()

  const inboxAddress = `inbox+${trip.inboxToken}@${inboxDomain}`
  const travelDocs = trip.documents.filter((d) => ['passport', 'visa', 'insurance'].includes(d.category))
  const bookingDocs = trip.documents.filter((d) => !['passport', 'visa', 'insurance'].includes(d.category))

  return (
    <>
      <div className="hero-light border-b border-line px-6 sm:px-10 py-8 sm:py-10">
        <div className="text-[10px] uppercase tracking-[0.22em] text-ink-muted">Documents</div>
        <h1 className="h-display text-4xl sm:text-6xl mt-2">Everything in one place.</h1>
        <p className="text-ink-muted mt-3 max-w-2xl text-sm sm:text-base break-words">
          Forward to <span className="num-mono text-ink text-xs sm:text-sm">{inboxAddress}</span> — Itinera files everything for you.
        </p>
      </div>

      <div className="px-4 sm:px-10 py-6 sm:py-10 max-w-7xl space-y-8 sm:space-y-10">
        <section>
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="font-display text-2xl">Travel</h2>
            <span className="text-xs text-ink-muted">{travelDocs.length} items</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {travelDocs.map((d) => {
              const Icon = categoryIcon(d.category)
              return (
                <div key={d.id} className="group border border-line rounded-xl bg-paper-pure p-5 hover:shadow-soft transition relative">
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition">
                    <InlineDeleteButton kind="document" id={d.id} tripSlug={trip.slug} />
                  </div>
                  <div className={`aspect-[4/3] rounded-lg ${categoryImg(d.title, d.category)} mb-3 grid place-items-center`}>
                    <Icon className="w-8 h-8 text-paper-pure/70" />
                  </div>
                  <div className="text-[10px] uppercase tracking-[0.18em] text-ink-muted">{d.category}</div>
                  <div className="font-display text-lg leading-tight mt-1">{d.title}</div>
                  {d.notes && <div className="text-xs text-ink-muted mt-1 num-mono">{d.notes}</div>}
                </div>
              )
            })}
            <button className="border-2 border-dashed border-line rounded-xl bg-paper/40 p-5 hover:bg-paper-pure transition grid place-items-center min-h-[220px]">
              <div className="text-center text-ink-muted">
                <Upload className="w-6 h-6 mx-auto mb-2" />
                <div className="text-sm">Drop or forward to add</div>
              </div>
            </button>
          </div>
        </section>

        <section>
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="font-display text-2xl">Bookings &amp; vouchers</h2>
            <span className="text-xs text-ink-muted">{bookingDocs.length} items</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {bookingDocs.map((d) => {
              const Icon = categoryIcon(d.category)
              return (
                <div key={d.id} className="group border border-line rounded-xl bg-paper-pure p-5 hover:shadow-soft transition relative">
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition">
                    <InlineDeleteButton kind="document" id={d.id} tripSlug={trip.slug} />
                  </div>
                  <div className={`aspect-[4/3] rounded-lg ${categoryImg(d.title, d.category)} mb-3 grid place-items-center`}>
                    <Icon className="w-8 h-8 text-paper-pure/70" />
                  </div>
                  <div className="text-[10px] uppercase tracking-[0.18em] text-ink-muted">{d.category}</div>
                  <div className="font-display text-lg leading-tight mt-1">{d.title}</div>
                  {d.notes && <div className="text-xs text-ink-muted mt-1 num-mono">{d.notes}</div>}
                </div>
              )
            })}
          </div>
        </section>
      </div>
    </>
  )
}
