/**
 * Destination registry — given a free-text destination string ("New Zealand",
 * "Japan", "Italy"), derive sensible defaults for timezone, local currency,
 * and approximate FX rate to the home currency.
 *
 * Used at trip create / edit time to populate Trip.timezone + Trip.localCurrency.
 * Real-time FX should pull from an API; the table below is a fallback for the prototype.
 */

export type DestinationHeroImage = {
  /** Direct image URL (preferably hosted on a stable CDN like Unsplash). */
  src: string
  /** Alt text describing the iconic scene. */
  alt: string
  /** Photographer attribution, shown discreetly in the corner. */
  credit?: string
  /**
   * CSS object-position value for the hero crop. Lets each photo land its
   * subject in the visible band regardless of how short the hero is on a
   * given device. Examples: 'center', '50% 65%' (biased low), '50% 30%' (biased high).
   * Default: 'center'.
   */
  objectPosition?: string
}

export type DestinationProfile = {
  /** Matchers for the user's free-text destination input */
  matchers: RegExp[]
  /** IANA timezone string */
  timezone: string
  /** ISO 4217 currency code */
  currency: string
  /** Friendly label */
  label: string
  /** Iconic hero image used at the top of the itinerary page. Optional —
   *  destinations without a curated image fall back to a plain gradient. */
  heroImage?: DestinationHeroImage
  /**
   * ISO 3166-1 numeric country code as a string (e.g. "554" for New Zealand,
   * "392" for Japan). Matches the `id` field in the world-atlas TopoJSON so
   * we can highlight the country on the Atlas map.
   */
  isoNumeric?: string
  /**
   * Cute emoji sticker representing something iconic about the country —
   * shown on the Atlas country card. e.g. "🗻" (Fuji) for Japan,
   * "🦘" for Australia, "🌮" for Mexico.
   */
  passportIcon?: string
}

// Build an Unsplash CDN URL for a given photo id with sensible sizing/quality
// for a large hero. Their CDN respects these params and returns an optimised JPEG.
const unsplash = (id: string) =>
  `https://images.unsplash.com/${id}?w=2400&q=80&auto=format&fit=crop`

const PROFILES: DestinationProfile[] = [
  { matchers: [/japan/i, /日本/], timezone: 'Asia/Tokyo', currency: 'JPY', label: 'Japan',
    isoNumeric: '392', passportIcon: '🗻',
    heroImage: {
      src: unsplash('photo-1493976040374-85c8e12f0c0e'),
      alt: 'Mount Fuji at dawn with cherry blossoms',
      credit: 'Unsplash',
      objectPosition: '50% 35%',
    } },
  { matchers: [/new\s*zealand/i, /\baotearoa\b/i, /\bnz\b/i], timezone: 'Pacific/Auckland', currency: 'NZD', label: 'New Zealand',
    isoNumeric: '554', passportIcon: '🥝',
    heroImage: {
      src: unsplash('photo-1469521669194-babb45599def'),
      alt: 'Lake Wakatipu and the Remarkables, Queenstown',
      credit: 'Unsplash',
      objectPosition: '50% 70%',
    } },
  { matchers: [/australia/i, /\bau\b/i], timezone: 'Australia/Sydney', currency: 'AUD', label: 'Australia',
    isoNumeric: '036', passportIcon: '🦘' },
  { matchers: [/italy/i, /italia/i], timezone: 'Europe/Rome', currency: 'EUR', label: 'Italy',
    isoNumeric: '380', passportIcon: '🍝' },
  { matchers: [/iceland/i, /ísland/i], timezone: 'Atlantic/Reykjavik', currency: 'ISK', label: 'Iceland',
    isoNumeric: '352', passportIcon: '🌋' },
  { matchers: [/thailand/i, /siam/i], timezone: 'Asia/Bangkok', currency: 'THB', label: 'Thailand',
    isoNumeric: '764', passportIcon: '🐘' },
  { matchers: [/france/i], timezone: 'Europe/Paris', currency: 'EUR', label: 'France',
    isoNumeric: '250', passportIcon: '🥐' },
  { matchers: [/spain/i, /españa/i], timezone: 'Europe/Madrid', currency: 'EUR', label: 'Spain',
    isoNumeric: '724', passportIcon: '💃' },
  { matchers: [/germany/i, /deutschland/i], timezone: 'Europe/Berlin', currency: 'EUR', label: 'Germany',
    isoNumeric: '276', passportIcon: '🥨' },
  { matchers: [/portugal/i], timezone: 'Europe/Lisbon', currency: 'EUR', label: 'Portugal',
    isoNumeric: '620', passportIcon: '🐟' },
  { matchers: [/united\s*kingdom/i, /\buk\b/i, /england/i, /scotland/i, /wales/i], timezone: 'Europe/London', currency: 'GBP', label: 'United Kingdom',
    isoNumeric: '826', passportIcon: '🎡' },
  { matchers: [/ireland/i, /éire/i], timezone: 'Europe/Dublin', currency: 'EUR', label: 'Ireland',
    isoNumeric: '372', passportIcon: '🍀' },
  { matchers: [/united\s*states/i, /\busa\b/i, /\bus\b/i, /america/i], timezone: 'America/New_York', currency: 'USD', label: 'United States',
    isoNumeric: '840', passportIcon: '🗽' },
  { matchers: [/canada/i], timezone: 'America/Toronto', currency: 'CAD', label: 'Canada',
    isoNumeric: '124', passportIcon: '🍁' },
  { matchers: [/mexico/i, /méxico/i], timezone: 'America/Mexico_City', currency: 'MXN', label: 'Mexico',
    isoNumeric: '484', passportIcon: '🌮' },
  { matchers: [/singapore/i], timezone: 'Asia/Singapore', currency: 'SGD', label: 'Singapore',
    isoNumeric: '702', passportIcon: '🏙️' },
  { matchers: [/indonesia/i, /bali/i], timezone: 'Asia/Jakarta', currency: 'IDR', label: 'Indonesia',
    isoNumeric: '360', passportIcon: '🏝️' },
  { matchers: [/vietnam/i], timezone: 'Asia/Ho_Chi_Minh', currency: 'VND', label: 'Vietnam',
    isoNumeric: '704', passportIcon: '🍜' },
  { matchers: [/south\s*korea/i, /\bkorea\b/i], timezone: 'Asia/Seoul', currency: 'KRW', label: 'South Korea',
    isoNumeric: '410', passportIcon: '🥢' },
  { matchers: [/china/i, /中国/i], timezone: 'Asia/Shanghai', currency: 'CNY', label: 'China',
    isoNumeric: '156', passportIcon: '🐼' },
  { matchers: [/hong\s*kong/i], timezone: 'Asia/Hong_Kong', currency: 'HKD', label: 'Hong Kong',
    isoNumeric: '344', passportIcon: '🏙️' },
  { matchers: [/india/i], timezone: 'Asia/Kolkata', currency: 'INR', label: 'India',
    isoNumeric: '356', passportIcon: '🕌' },
]

const FALLBACK: Omit<DestinationProfile, 'matchers'> = {
  timezone: 'UTC',
  currency: 'USD',
  label: 'Unknown',
}

/** Look up a destination profile by ISO 3166-1 numeric code. */
export function profileForIsoNumeric(isoNumeric: string): Omit<DestinationProfile, 'matchers'> | null {
  const p = PROFILES.find((p) => p.isoNumeric === isoNumeric)
  if (!p) return null
  return {
    timezone: p.timezone,
    currency: p.currency,
    label: p.label,
    heroImage: p.heroImage,
    isoNumeric: p.isoNumeric,
    passportIcon: p.passportIcon,
  }
}

/**
 * All known destinations (without their matchers), for use in dropdown
 * pickers — e.g. the "I've been here" form on the Atlas page.
 * Sorted alphabetically by label for stable UI ordering.
 */
export function listDestinations(): Array<Omit<DestinationProfile, 'matchers'>> {
  return PROFILES
    .filter((p) => p.isoNumeric)
    .map((p) => ({
      timezone: p.timezone,
      currency: p.currency,
      label: p.label,
      heroImage: p.heroImage,
      isoNumeric: p.isoNumeric,
      passportIcon: p.passportIcon,
    }))
    .sort((a, b) => a.label.localeCompare(b.label))
}

export function profileForDestination(destination: string | null | undefined): Omit<DestinationProfile, 'matchers'> {
  if (!destination) return FALLBACK
  for (const p of PROFILES) {
    if (p.matchers.some((r) => r.test(destination))) {
      return {
        timezone: p.timezone,
        currency: p.currency,
        label: p.label,
        heroImage: p.heroImage,
        isoNumeric: p.isoNumeric,
        passportIcon: p.passportIcon,
      }
    }
  }
  return FALLBACK
}

// ----- FX (prototype rates) ---------------------------------------------------------
// 1 unit of FROM currency = N units of TO currency. Update from an FX API in v2.

const FX_PER_USD: Record<string, number> = {
  USD: 1,
  AUD: 1.50,
  NZD: 1.65,
  EUR: 0.92,
  GBP: 0.79,
  CAD: 1.36,
  JPY: 149.32,
  THB: 35.40,
  SGD: 1.35,
  IDR: 15800,
  VND: 24500,
  KRW: 1330,
  CNY: 7.20,
  HKD: 7.82,
  INR: 83.20,
  MXN: 17.10,
  ISK: 138.40,
}

/** Convert amount in fromCurrency to toCurrency, returning the converted number. */
export function convertCurrency(amount: number, fromCurrency: string, toCurrency: string): number {
  const f = FX_PER_USD[fromCurrency.toUpperCase()] ?? 1
  const t = FX_PER_USD[toCurrency.toUpperCase()] ?? 1
  return (amount / f) * t
}

/** "1 AUD = 1.10 NZD" style label */
export function fxLabel(homeCurrency: string, localCurrency: string): string {
  const rate = convertCurrency(1, homeCurrency, localCurrency)
  const formatted = rate >= 100 ? rate.toFixed(0)
                  : rate >= 10  ? rate.toFixed(1)
                  : rate.toFixed(2)
  return `1 ${homeCurrency} = ${formatted} ${localCurrency}`
}
