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
 * Images are hot-linked from Unsplash (same CDN helper the destinations
 * registry uses). The ids were sourced from each location's Unsplash search
 * page; captions are hand-written so they describe the place accurately. If
 * any image ever fails to load, the landing photo panel falls back to a warm
 * gradient (see LandingPhotoClient) rather than showing a broken image.
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
}

// Unsplash CDN helper (sized for a tall half-screen panel).
const unsplash = (id: string) =>
  `https://images.unsplash.com/${id}?w=1600&q=80&auto=format&fit=crop`

export const LANDING_PHOTOS: LandingPhoto[] = [
  {
    src: unsplash('photo-1490782300182-697b80ad4293'),
    place: 'Valparaíso',
    country: 'Chile',
    blurb: 'Mural-splashed houses tumbling down the hills to the Pacific.',
  },
  {
    src: unsplash('photo-1569383746724-6f1b882b8f46'),
    place: 'Chefchaouen',
    country: 'Morocco',
    blurb: 'Blue-washed lanes climbing the Rif Mountains.',
  },
  {
    src: unsplash('photo-1714314172336-79977c493485'),
    place: 'Tbilisi',
    country: 'Georgia',
    blurb: 'Carved balconies over the cobbled lanes of the old town.',
  },
  {
    src: unsplash('photo-1614122027743-50a9e6e8002f'),
    place: 'Kotor',
    country: 'Montenegro',
    blurb: 'A walled medieval town at the head of a fjord-like Adriatic bay.',
  },
  {
    src: unsplash('photo-1743428914675-cbaab13e5483'),
    place: 'Guanajuato',
    country: 'Mexico',
    blurb: 'A ravine city of candy-coloured houses and hidden tunnels.',
  },
  {
    src: unsplash('photo-1686825780583-8be7c349a4b4'),
    place: 'Jodhpur',
    country: 'India',
    blurb: 'The Blue City spilling out beneath Mehrangarh Fort.',
  },
  {
    src: unsplash('photo-1744593419072-a19dbbf7e0f3'),
    place: 'Luang Prabang',
    country: 'Laos',
    blurb: 'Saffron-robed monks gathering alms at first light.',
  },
  {
    src: unsplash('photo-1716827684910-28b9415055eb'),
    place: 'Plovdiv',
    country: 'Bulgaria',
    blurb: 'Cobblestone cafés in the Kapana artists’ quarter.',
  },
  {
    src: unsplash('photo-1693669029454-ab14dd80faaa'),
    place: 'Comuna 13, Medellín',
    country: 'Colombia',
    blurb: 'Hillside street art above the open-air escalators.',
  },
  {
    src: unsplash('photo-1748643874434-889363ca1295'),
    place: 'Purmamarca',
    country: 'Argentina',
    blurb: 'A market street below the Hill of Seven Colours.',
  },
  {
    src: unsplash('photo-1747706053335-d6895f44a97d'),
    place: 'Tobermory',
    country: 'Scotland',
    blurb: 'A curve of painted harbour houses on the Isle of Mull.',
  },
]

/** The photo for a given day — deterministic by day-of-year (UTC). */
export function photoOfTheDay(date: Date = new Date()): LandingPhoto {
  const startOfYear = Date.UTC(date.getUTCFullYear(), 0, 0)
  const today = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  const dayOfYear = Math.floor((today - startOfYear) / 86_400_000)
  return LANDING_PHOTOS[dayOfYear % LANDING_PHOTOS.length]
}
