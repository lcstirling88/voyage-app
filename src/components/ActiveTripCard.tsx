import Link from 'next/link'
import { format } from 'date-fns'
import { profileForDestination } from '@/lib/destinations'

/**
 * Big hero-image card for an in-flight or upcoming trip. Used on the
 * profile page so each active trip gets its own beautiful entry point —
 * same destination photo as the itinerary page hero, country name +
 * "Trip" suffix overlaid (e.g. "New Zealand Trip"). Tapping it dives
 * into the full trip in the existing /trips/[slug] layout.
 */
export function ActiveTripCard({
  trip,
}: {
  trip: { slug: string; destination: string; startDate: Date; endDate: Date }
}) {
  const profile = profileForDestination(trip.destination)
  const heroImage = profile.heroImage
  const countryLabel = profile.label

  const today = new Date()
  const inProgress = trip.startDate <= today && trip.endDate >= today
  const status = inProgress ? 'On the road' : 'Upcoming'

  return (
    <Link
      href={`/trips/${trip.slug}`}
      className="block group rounded-xl overflow-hidden border border-line bg-line-soft relative h-52 sm:h-64 shadow-soft hover:shadow-lift transition"
      aria-label={`Open ${countryLabel} trip`}
    >
      {heroImage ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={heroImage.src}
          alt={heroImage.alt}
          className="absolute inset-0 w-full h-full object-cover transition duration-500 group-hover:scale-105"
          style={{ objectPosition: heroImage.objectPosition ?? 'center' }}
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-sage to-ink" />
      )}

      {/* Gradient overlay so the text always reads, regardless of photo. */}
      <div className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/30 to-transparent" />

      <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6 text-paper-pure">
        <div className="text-[10px] uppercase tracking-[0.22em] text-paper-pure/75 flex items-center gap-2">
          <span className={`inline-block w-1.5 h-1.5 rounded-full ${inProgress ? 'bg-gold' : 'bg-paper-pure/70'}`} aria-hidden />
          <span>{status}</span>
          <span className="text-paper-pure/40">·</span>
          <span className="num-mono">
            {format(trip.startDate, 'MMM d')} – {format(trip.endDate, 'MMM d, yyyy')}
          </span>
        </div>
        <h2 className="font-display text-2xl sm:text-3xl mt-1.5">
          {countryLabel} Trip
        </h2>
      </div>
    </Link>
  )
}
