import { format } from 'date-fns'
import { prisma } from '@/lib/db'
import { requireTripAccess } from '@/lib/session'
import { EditTripFormClient } from '@/components/EditTripFormClient'
import { InviteFormClient } from '@/components/InviteFormClient'

const inboxDomain = process.env.NEXT_PUBLIC_INBOX_DOMAIN ?? 'voyage.local'

export default async function TripSettingsPage({ params }: { params: Promise<{ tripSlug: string }> }) {
  const { tripSlug } = await params
  const { user, role } = await requireTripAccess(tripSlug)

  const trip = await prisma.trip.findUnique({
    where: { slug: tripSlug },
    include: {
      _count: { select: { bookings: true, documents: true } },
      memberships: { include: { user: true }, orderBy: { createdAt: 'asc' } },
    },
  })
  if (!trip) return null

  const inboxAddress = `inbox+${trip.inboxToken}@${inboxDomain}`

  return (
    <>
      <div className="hero-light border-b border-line px-6 sm:px-10 py-8 sm:py-10">
        <div className="text-[10px] uppercase tracking-[0.22em] text-ink-muted">Trip settings</div>
        <h1 className="h-display text-4xl sm:text-6xl mt-2">{trip.name}.</h1>
        <p className="text-ink-muted mt-3 max-w-xl text-sm sm:text-base">Edit, invite people, or remove the trip entirely.</p>
      </div>

      <div className="px-4 sm:px-10 py-8 sm:py-12 max-w-3xl space-y-10 sm:space-y-16">
        {/* Sharing */}
        <section>
          <div className="mb-4">
            <h2 className="font-display text-2xl">Who&apos;s on this trip</h2>
            <p className="text-sm text-ink-muted mt-1">
              Invite your travel companions. They&apos;ll get an email link to accept — once they do, they see everything you see.
            </p>
          </div>
          <InviteFormClient
            tripSlug={trip.slug}
            members={trip.memberships}
            currentUserId={user.id}
            isOwner={role === 'owner'}
          />
        </section>

        {/* Inbox address (just informational here too) */}
        <section>
          <h2 className="font-display text-2xl mb-3">Inbox address</h2>
          <p className="text-sm text-ink-muted mb-3">Forward booking emails here and Voyage files them onto this trip.</p>
          <code className="num-mono text-sm bg-paper-pure border border-line rounded px-3 py-2 inline-block">
            {inboxAddress}
          </code>
        </section>

        {/* Trip details + danger zone */}
        <section>
          <div className="mb-6">
            <h2 className="font-display text-2xl">Trip details</h2>
            <p className="text-sm text-ink-muted mt-1">Edit any of the basics, or scroll down to delete the trip.</p>
          </div>
          <EditTripFormClient
            trip={{
              id: trip.id,
              name: trip.name,
              tagline: trip.tagline,
              destination: trip.destination,
              themeKey: trip.themeKey,
              startDate: format(trip.startDate, 'yyyy-MM-dd'),
              endDate: format(trip.endDate, 'yyyy-MM-dd'),
              homeCurrency: trip.homeCurrency,
              travelerNames: trip.travelerNames,
              departureCity: trip.departureCity,
              adultCount: trip.adultCount,
              childCount: trip.childCount,
              childrenAges: trip.childrenAges,
              colorPalette: trip.colorPalette,
              inboxToken: trip.inboxToken,
              bookingsCount: trip._count.bookings,
              documentsCount: trip._count.documents,
            }}
          />
        </section>
      </div>
    </>
  )
}
