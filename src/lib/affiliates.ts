/**
 * "Book it" deep-links for the planning → booking bridge. When a traveller is
 * ready to act on a PLANNED item, this sends them to a provider with the place
 * pre-filled. Partner IDs are read from env (AFFILIATE_*) — unset means plain,
 * still-useful deep links — so real affiliate accounts slot in later with no
 * code change. This is where the product earns: a kept idea becomes a booking.
 */

import { format } from 'date-fns'
import type { Booking } from '@prisma/client'

const BOOKING_AID = process.env.AFFILIATE_BOOKING_AID || ''       // Booking.com partner aid
const GYG_PARTNER = process.env.AFFILIATE_GETYOURGUIDE_ID || ''   // GetYourGuide partner_id

function enc(s: string): string {
  return encodeURIComponent(s.trim())
}

export type BookingLink = { label: string; url: string }

/**
 * A deep-link to book/reserve a planned item, chosen by type:
 *   hotel       → Booking.com search (with the stay's dates)
 *   activity/…  → GetYourGuide search (tours & experiences — the monetisable case)
 *   restaurant  → Google Maps (find & reserve)
 *   flight      → Google Flights search
 *   transit/car → a plain web search
 * Returns null only when there's no title to search on.
 */
export function bookingLinkFor(
  booking: Pick<Booking, 'type' | 'title' | 'location' | 'startAt' | 'endAt'>,
  destination?: string,
): BookingLink | null {
  const title = (booking.title || '').trim()
  if (!title) return null
  const where = (booking.location || destination || '').trim()
  const query = where ? `${title} ${where}` : title

  switch (booking.type) {
    case 'hotel': {
      const params = new URLSearchParams({ ss: title })
      params.set('checkin', format(booking.startAt, 'yyyy-MM-dd'))
      if (booking.endAt) params.set('checkout', format(booking.endAt, 'yyyy-MM-dd'))
      if (BOOKING_AID) params.set('aid', BOOKING_AID)
      return { label: 'Book it', url: `https://www.booking.com/searchresults.html?${params.toString()}` }
    }
    case 'flight':
      return { label: 'Find flights', url: `https://www.google.com/travel/flights?q=${enc(`flights ${where || title}`)}` }
    case 'restaurant':
      return { label: 'Reserve', url: `https://www.google.com/maps/search/${enc(query)}` }
    case 'transit':
    case 'car':
      return { label: 'Find it', url: `https://www.google.com/search?q=${enc(query)}` }
    default: {
      // activity, tour, experience, anything else
      const params = new URLSearchParams({ q: query })
      if (GYG_PARTNER) params.set('partner_id', GYG_PARTNER)
      return { label: 'Book it', url: `https://www.getyourguide.com/s/?${params.toString()}` }
    }
  }
}
