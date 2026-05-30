import { notFound } from 'next/navigation'
import { FileText, Bed, Ticket, Upload, ExternalLink, Image as ImageIcon } from 'lucide-react'
import { prisma } from '@/lib/db'
import { requireTripAccess } from '@/lib/session'
import { InlineDeleteButton } from '@/components/InlineDeleteButton'

const inboxDomain = process.env.NEXT_PUBLIC_INBOX_DOMAIN ?? 'voyage.local'

const categoryIcon = (cat: string) => {
  if (cat === 'passport' || cat === 'visa' || cat === 'insurance') return FileText
  if (cat === 'ticket') return Ticket
  if (cat === 'voucher') return Bed
  return FileText
}

const fileIcon = (mimeType: string) =>
  (mimeType || '').toLowerCase().startsWith('image/') ? ImageIcon : FileText

/**
 * A parsed Document card (category / title / notes from the email parser).
 * When we know which email it came from, the whole card links to that email's
 * detail page — that's where the downloadable attachment lives (and the
 * "re-parse with files" form), so the card is no longer a dead end.
 */
function DocCard({
  doc,
  tripSlug,
}: {
  doc: { id: string; category: string; title: string; notes: string | null; sourceEmailId: string | null }
  tripSlug: string
}) {
  const Icon = categoryIcon(doc.category)
  const href = doc.sourceEmailId ? `/trips/${tripSlug}/inbox/${doc.sourceEmailId}` : null
  const inner = (
    <>
      <div className="aspect-[4/3] rounded-lg bg-sage-soft mb-3 grid place-items-center">
        <Icon className="w-8 h-8 text-sage" />
      </div>
      <div className="text-[10px] uppercase tracking-[0.18em] text-ink-muted">{doc.category}</div>
      <div className="font-display text-lg leading-tight mt-1">{doc.title}</div>
      {doc.notes && <div className="text-xs text-ink-muted mt-1 num-mono">{doc.notes}</div>}
      {href && (
        <div className="mt-2 inline-flex items-center gap-1 text-[11px] text-sage opacity-70 group-hover:opacity-100 transition">
          <ExternalLink className="w-3 h-3" /> View source email
        </div>
      )}
    </>
  )
  return (
    <div className="group border border-line rounded-xl bg-paper-pure p-5 hover:border-sage hover:shadow-soft transition relative">
      {/* Delete button is a sibling of the link (not nested inside the anchor) and
          sits above it so its click is never swallowed by the card link. */}
      <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition">
        <InlineDeleteButton kind="document" id={doc.id} tripSlug={tripSlug} />
      </div>
      {href ? (
        <a href={href} className="block">
          {inner}
        </a>
      ) : (
        inner
      )}
    </div>
  )
}

export default async function DocumentsPage({ params }: { params: Promise<{ tripSlug: string }> }) {
  const { tripSlug } = await params
  // Defence-in-depth: this page renders Blob URLs for passports / e-tickets, so
  // re-check trip access here rather than trusting only the layout gate.
  await requireTripAccess(tripSlug)
  const trip = await prisma.trip.findUnique({
    where: { slug: tripSlug },
    include: { documents: { orderBy: { createdAt: 'asc' } } },
  })
  if (!trip) notFound()

  // The actual stored files (PDFs / images) that came in on booking emails.
  // storagePath holds the Blob URL; only rows with a non-empty path have a
  // real file behind them (others were 0-byte or arrived before Blob was on).
  const files = await prisma.emailAttachment.findMany({
    where: { email: { tripId: trip.id }, storagePath: { not: '' } },
    include: { email: { select: { subject: true, receivedAt: true } } },
    orderBy: { email: { receivedAt: 'desc' } },
  })

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
        {/* Stored files — the actual PDFs / images from booking emails.
            These open the real confirmation, not just metadata. */}
        {files.length > 0 && (
          <section>
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="font-display text-2xl">Files</h2>
              <span className="text-xs text-ink-muted">{files.length} {files.length === 1 ? 'file' : 'files'}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {files.map((f) => {
                const Icon = fileIcon(f.mimeType)
                return (
                  <a
                    key={f.id}
                    href={f.storagePath}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group border border-line rounded-xl bg-paper-pure p-4 hover:border-sage hover:shadow-soft transition flex items-center gap-3"
                  >
                    <div className="w-11 h-11 rounded-lg bg-sage-soft grid place-items-center shrink-0">
                      <Icon className="w-5 h-5 text-sage" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-display text-sm leading-tight truncate">{f.filename}</div>
                      <div className="text-[10px] text-ink-muted num-mono mt-0.5">
                        {(f.size / 1024).toFixed(0)} KB
                        {f.email?.subject ? <span className="hidden sm:inline"> · {f.email.subject}</span> : null}
                      </div>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-ink-muted/50 group-hover:text-sage shrink-0" />
                  </a>
                )
              })}
            </div>
          </section>
        )}

        <section>
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="font-display text-2xl">Travel</h2>
            <span className="text-xs text-ink-muted">{travelDocs.length} items</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {travelDocs.map((d) => (
              <DocCard key={d.id} doc={d} tripSlug={trip.slug} />
            ))}
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
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {bookingDocs.map((d) => (
              <DocCard key={d.id} doc={d} tripSlug={trip.slug} />
            ))}
          </div>
        </section>
      </div>
    </>
  )
}
