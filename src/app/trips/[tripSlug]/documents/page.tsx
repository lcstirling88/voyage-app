import { notFound } from 'next/navigation'
import { format } from 'date-fns'
import { prisma } from '@/lib/db'
import { requireTripAccess } from '@/lib/session'
import { cityForBooking } from '@/lib/itinerary'
import { DocumentsBrowserClient, type DocItem, type DocType } from '@/components/DocumentsBrowserClient'

const inboxDomain = process.env.NEXT_PUBLIC_INBOX_DOMAIN ?? 'voyage.local'

// Booking type → document group.
function bookingDocType(type: string): DocType {
  switch (type) {
    case 'flight': return 'flight'
    case 'hotel': return 'hotel'
    case 'car': return 'car'
    case 'transit': return 'transit'
    case 'activity': return 'activity'
    case 'restaurant': return 'dining'
    default: return 'other'
  }
}

// Parsed-document category → document group.
function categoryDocType(cat: string): DocType {
  switch (cat) {
    case 'insurance': return 'insurance'
    case 'visa': return 'visa'
    case 'passport': return 'passport'
    case 'ticket': return 'ticket'
    case 'voucher': return 'voucher'
    case 'flight': return 'flight'
    case 'hotel': return 'hotel'
    default: return 'other'
  }
}

/**
 * Documents tab.
 *
 * Builds one flat, deduplicated list from the trip's incoming emails, with a
 * strict precedence so nothing is shown twice (issue #1):
 *
 *   1. Email has a downloadable attachment → show the FILE(s). The PDF is the
 *      canonical document, so the parsed Document cards / email link for that
 *      same email are suppressed.
 *   2. Email has bookings but no attachment → the confirmation email itself
 *      becomes the document, linking to its detail page (issue #3).
 *   3. Email has only parsed documents → show those, linking to the email.
 *
 * Items are grouped by type and sorted by date in the browser component, with
 * a city filter to condense the view (issue #2).
 */
export default async function DocumentsPage({ params }: { params: Promise<{ tripSlug: string }> }) {
  const { tripSlug } = await params
  // Defence-in-depth: this page links to private files, so re-check access here.
  await requireTripAccess(tripSlug)

  const trip = await prisma.trip.findUnique({
    where: { slug: tripSlug },
    select: {
      id: true,
      slug: true,
      inboxToken: true,
      documents: { select: { id: true, category: true, title: true, notes: true, sourceEmailId: true } },
    },
  })
  if (!trip) notFound()

  const emails = await prisma.incomingEmail.findMany({
    where: { tripId: trip.id },
    orderBy: { receivedAt: 'desc' },
    select: {
      id: true,
      subject: true,
      attachments: {
        // Only attachments with a real stored file behind them are downloadable.
        where: { storagePath: { not: '' } },
        select: { id: true, filename: true, size: true },
        orderBy: { filename: 'asc' },
      },
      bookings: {
        select: { id: true, type: true, title: true, vendor: true, startAt: true, location: true, address: true },
        orderBy: { startAt: 'asc' },
      },
      documents: { select: { id: true, category: true, title: true, notes: true } },
    },
  })

  const items: DocItem[] = []
  const handledDocIds = new Set<string>()

  for (const email of emails) {
    const files = email.attachments
    const bookings = email.bookings
    const docs = email.documents
    const primary = bookings[0] ?? null
    const emailHref = `/trips/${trip.slug}/inbox/${email.id}`
    const city = primary ? cityForBooking(primary) : null
    const dateMs = primary ? primary.startAt.getTime() : null
    const dateLabel = primary ? format(primary.startAt, 'MMM d') : null

    if (files.length > 0) {
      // (1) File supersedes — emit downloadable items, suppress this email's docs.
      const type: DocType = primary
        ? bookingDocType(primary.type)
        : docs[0]
          ? categoryDocType(docs[0].category)
          : 'other'
      const baseTitle = primary?.title ?? docs[0]?.title ?? null
      for (const f of files) {
        items.push({
          key: `att-${f.id}`,
          type,
          title: baseTitle ?? f.filename,
          subtitle: `${f.filename} · ${(f.size / 1024).toFixed(0)} KB`,
          dateMs,
          dateLabel,
          city,
          fileId: f.id,
        })
      }
      docs.forEach((d) => handledDocIds.add(d.id))
    } else if (primary) {
      // (2) No attachment — the confirmation email is the document.
      items.push({
        key: `email-${email.id}`,
        type: bookingDocType(primary.type),
        title: primary.title,
        subtitle: primary.vendor ? `${primary.vendor} · Confirmation email` : 'Confirmation email',
        dateMs,
        dateLabel,
        city,
        href: emailHref,
      })
      docs.forEach((d) => handledDocIds.add(d.id))
    } else if (docs.length > 0) {
      // (3) Parsed metadata only — link to the email it came from.
      for (const d of docs) {
        items.push({
          key: `doc-${d.id}`,
          type: categoryDocType(d.category),
          title: d.title,
          subtitle: d.notes ?? `from ${email.subject}`,
          dateMs: null,
          dateLabel: null,
          city: null,
          href: emailHref,
        })
        handledDocIds.add(d.id)
      }
    }
  }

  // Orphan documents not tied to any handled email (manual / seed data).
  for (const d of trip.documents) {
    if (handledDocIds.has(d.id)) continue
    items.push({
      key: `doc-${d.id}`,
      type: categoryDocType(d.category),
      title: d.title,
      subtitle: d.notes ?? undefined,
      dateMs: null,
      dateLabel: null,
      city: null,
      href: d.sourceEmailId ? `/trips/${trip.slug}/inbox/${d.sourceEmailId}` : undefined,
    })
  }

  // Distinct cities for the filter chips.
  const cities = [...new Set(items.map((i) => i.city).filter((c): c is string => Boolean(c)))].sort()

  const inboxAddress = `inbox+${trip.inboxToken}@${inboxDomain}`

  return (
    <>
      <div className="hero-light border-b border-line px-6 sm:px-10 py-8 sm:py-10">
        <div className="text-[10px] uppercase tracking-[0.22em] text-ink-muted">Documents</div>
        <h1 className="h-display text-4xl sm:text-6xl mt-2">Everything in one place.</h1>
        <p className="text-ink-muted mt-3 max-w-2xl text-sm sm:text-base break-words">
          Forward to <span className="num-mono text-ink text-xs sm:text-sm">{inboxAddress}</span> — Itinera files everything for you.
        </p>
      </div>

      <div className="px-4 sm:px-10 py-6 sm:py-10 max-w-7xl">
        <DocumentsBrowserClient items={items} cities={cities} />
      </div>
    </>
  )
}
