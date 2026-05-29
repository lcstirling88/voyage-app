/**
 * Daily-rotating inspiration photos for the landing page.
 *
 * One photo shows per day — deterministic (day-of-year % list length), so it
 * advances at midnight and is the same for every visitor. Each carries a
 * "what + where" caption shown along the bottom of the image.
 *
 * The brief: NO postcard clichés (no Eiffel Tower, no Big Ben) — lesser-known
 * places and street scenes that make someone want to go somewhere they hadn't
 * thought of.
 *
 * NOTE: this is a STARTER set, seeded from the two licence-clean images already
 * verified in the app. The intent is to grow it toward ~20 curated, non-cliché
 * shots — add entries below (each needs a real, verified Unsplash photo id so
 * the image loads and the caption matches what's actually pictured).
 */

export type LandingPhoto = {
  /** Unsplash CDN image. */
  src: string
  /** Where: the specific place. */
  place: string
  /** Where: the country. */
  country: string
  /** What: a one-line description of the scene. */
  blurb: string
  /** CSS object-position for the crop (default 'center'). */
  objectPosition?: string
  credit?: string
}

// Same Unsplash CDN helper the destinations registry uses — sized for a tall
// half-screen panel.
const unsplash = (id: string) =>
  `https://images.unsplash.com/${id}?w=1600&q=80&auto=format&fit=crop`

export const LANDING_PHOTOS: LandingPhoto[] = [
  {
    src: unsplash('photo-1493976040374-85c8e12f0c0e'),
    place: 'Fuji Five Lakes',
    country: 'Japan',
    blurb: 'Mount Fuji catching first light above the cherry blossoms.',
    objectPosition: '50% 35%',
    credit: 'Unsplash',
  },
  {
    src: unsplash('photo-1469521669194-babb45599def'),
    place: 'Lake Wakatipu',
    country: 'New Zealand',
    blurb: 'The Remarkables mirrored in a glacial lake near Queenstown.',
    objectPosition: '50% 60%',
    credit: 'Unsplash',
  },
]

/** The photo for a given day — deterministic by day-of-year (UTC). */
export function photoOfTheDay(date: Date = new Date()): LandingPhoto {
  const startOfYear = Date.UTC(date.getUTCFullYear(), 0, 0)
  const today = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  const dayOfYear = Math.floor((today - startOfYear) / 86_400_000)
  return LANDING_PHOTOS[dayOfYear % LANDING_PHOTOS.length]
}
