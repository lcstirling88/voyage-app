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

  // ---- Additional Europe ----
  { matchers: [/greece/i, /hellas/i], timezone: 'Europe/Athens', currency: 'EUR', label: 'Greece',
    isoNumeric: '300', passportIcon: '🏛️' },
  { matchers: [/netherlands/i, /holland/i, /amsterdam/i], timezone: 'Europe/Amsterdam', currency: 'EUR', label: 'Netherlands',
    isoNumeric: '528', passportIcon: '🌷' },
  { matchers: [/switzerland/i, /\bswiss\b/i], timezone: 'Europe/Zurich', currency: 'CHF', label: 'Switzerland',
    isoNumeric: '756', passportIcon: '🏔️' },
  { matchers: [/austria/i, /österreich/i, /vienna/i], timezone: 'Europe/Vienna', currency: 'EUR', label: 'Austria',
    isoNumeric: '040', passportIcon: '🎻' },
  { matchers: [/belgium/i, /\bbelg\b/i], timezone: 'Europe/Brussels', currency: 'EUR', label: 'Belgium',
    isoNumeric: '056', passportIcon: '🧇' },
  { matchers: [/croatia/i, /hrvatska/i, /\bdalmatian\b/i], timezone: 'Europe/Zagreb', currency: 'EUR', label: 'Croatia',
    isoNumeric: '191', passportIcon: '⛵' },
  { matchers: [/\bczech/i, /czechia/i, /prague/i], timezone: 'Europe/Prague', currency: 'CZK', label: 'Czechia',
    isoNumeric: '203', passportIcon: '🍺' },
  { matchers: [/hungary/i, /magyar/i, /budapest/i], timezone: 'Europe/Budapest', currency: 'HUF', label: 'Hungary',
    isoNumeric: '348', passportIcon: '🥟' },
  { matchers: [/norway/i, /norge/i], timezone: 'Europe/Oslo', currency: 'NOK', label: 'Norway',
    isoNumeric: '578', passportIcon: '🌌' },
  { matchers: [/sweden/i, /sverige/i], timezone: 'Europe/Stockholm', currency: 'SEK', label: 'Sweden',
    isoNumeric: '752', passportIcon: '🎿' },
  { matchers: [/denmark/i, /danmark/i, /copenhagen/i], timezone: 'Europe/Copenhagen', currency: 'DKK', label: 'Denmark',
    isoNumeric: '208', passportIcon: '🚴' },
  { matchers: [/finland/i, /suomi/i], timezone: 'Europe/Helsinki', currency: 'EUR', label: 'Finland',
    isoNumeric: '246', passportIcon: '🌲' },
  { matchers: [/poland/i, /polska/i], timezone: 'Europe/Warsaw', currency: 'PLN', label: 'Poland',
    isoNumeric: '616', passportIcon: '🥟' },
  { matchers: [/turkey/i, /türkiye/i, /istanbul/i], timezone: 'Europe/Istanbul', currency: 'TRY', label: 'Turkey',
    isoNumeric: '792', passportIcon: '🕌' },

  // ---- South / Central America ----
  { matchers: [/argentina/i, /buenos\s*aires/i], timezone: 'America/Argentina/Buenos_Aires', currency: 'ARS', label: 'Argentina',
    isoNumeric: '032', passportIcon: '💃' },
  { matchers: [/brazil/i, /brasil/i], timezone: 'America/Sao_Paulo', currency: 'BRL', label: 'Brazil',
    isoNumeric: '076', passportIcon: '🎭' },
  { matchers: [/chile/i, /patagonia/i], timezone: 'America/Santiago', currency: 'CLP', label: 'Chile',
    isoNumeric: '152', passportIcon: '🏔️' },
  { matchers: [/peru/i, /\bcuzco\b/i, /\bcusco\b/i, /machu\s*picchu/i], timezone: 'America/Lima', currency: 'PEN', label: 'Peru',
    isoNumeric: '604', passportIcon: '🦙' },
  { matchers: [/colombia/i], timezone: 'America/Bogota', currency: 'COP', label: 'Colombia',
    isoNumeric: '170', passportIcon: '☕' },
  { matchers: [/costa\s*rica/i], timezone: 'America/Costa_Rica', currency: 'CRC', label: 'Costa Rica',
    isoNumeric: '188', passportIcon: '🦥' },
  { matchers: [/cuba/i, /havana/i], timezone: 'America/Havana', currency: 'CUP', label: 'Cuba',
    isoNumeric: '192', passportIcon: '🚗' },
  { matchers: [/ecuador/i, /galapagos/i], timezone: 'America/Guayaquil', currency: 'USD', label: 'Ecuador',
    isoNumeric: '218', passportIcon: '🐢' },

  // ---- More Asia ----
  { matchers: [/philippines/i, /manila/i], timezone: 'Asia/Manila', currency: 'PHP', label: 'Philippines',
    isoNumeric: '608', passportIcon: '🏝️' },
  { matchers: [/malaysia/i, /kuala\s*lumpur/i], timezone: 'Asia/Kuala_Lumpur', currency: 'MYR', label: 'Malaysia',
    isoNumeric: '458', passportIcon: '🌆' },
  { matchers: [/cambodia/i, /angkor/i], timezone: 'Asia/Phnom_Penh', currency: 'KHR', label: 'Cambodia',
    isoNumeric: '116', passportIcon: '🛕' },
  { matchers: [/laos/i], timezone: 'Asia/Vientiane', currency: 'LAK', label: 'Laos',
    isoNumeric: '418', passportIcon: '🛕' },
  { matchers: [/myanmar/i, /burma/i], timezone: 'Asia/Yangon', currency: 'MMK', label: 'Myanmar',
    isoNumeric: '104', passportIcon: '🛕' },
  { matchers: [/sri\s*lanka/i, /ceylon/i], timezone: 'Asia/Colombo', currency: 'LKR', label: 'Sri Lanka',
    isoNumeric: '144', passportIcon: '🐘' },
  { matchers: [/nepal/i, /kathmandu/i, /everest/i], timezone: 'Asia/Kathmandu', currency: 'NPR', label: 'Nepal',
    isoNumeric: '524', passportIcon: '🏔️' },
  { matchers: [/maldives/i], timezone: 'Indian/Maldives', currency: 'MVR', label: 'Maldives',
    isoNumeric: '462', passportIcon: '🏖️' },
  { matchers: [/uae/i, /united\s*arab\s*emirates/i, /dubai/i, /abu\s*dhabi/i], timezone: 'Asia/Dubai', currency: 'AED', label: 'United Arab Emirates',
    isoNumeric: '784', passportIcon: '🌃' },
  { matchers: [/israel/i, /jerusalem/i, /tel\s*aviv/i], timezone: 'Asia/Jerusalem', currency: 'ILS', label: 'Israel',
    isoNumeric: '376', passportIcon: '🕯️' },
  { matchers: [/jordan/i, /petra/i, /amman/i], timezone: 'Asia/Amman', currency: 'JOD', label: 'Jordan',
    isoNumeric: '400', passportIcon: '🏜️' },
  { matchers: [/taiwan/i, /\btaipei\b/i], timezone: 'Asia/Taipei', currency: 'TWD', label: 'Taiwan',
    isoNumeric: '158', passportIcon: '🥟' },

  // ---- Africa ----
  { matchers: [/south\s*africa/i, /cape\s*town/i], timezone: 'Africa/Johannesburg', currency: 'ZAR', label: 'South Africa',
    isoNumeric: '710', passportIcon: '🦁' },
  { matchers: [/morocco/i, /marrakech/i, /casablanca/i], timezone: 'Africa/Casablanca', currency: 'MAD', label: 'Morocco',
    isoNumeric: '504', passportIcon: '🐪' },
  { matchers: [/egypt/i, /cairo/i, /pyramid/i], timezone: 'Africa/Cairo', currency: 'EGP', label: 'Egypt',
    isoNumeric: '818', passportIcon: '🐫' },
  { matchers: [/kenya/i, /\bnairobi\b/i, /\bmasai\b/i], timezone: 'Africa/Nairobi', currency: 'KES', label: 'Kenya',
    isoNumeric: '404', passportIcon: '🦒' },
  { matchers: [/tanzania/i, /zanzibar/i, /serengeti/i, /kilimanjaro/i], timezone: 'Africa/Dar_es_Salaam', currency: 'TZS', label: 'Tanzania',
    isoNumeric: '834', passportIcon: '🦓' },
  { matchers: [/namibia/i], timezone: 'Africa/Windhoek', currency: 'NAD', label: 'Namibia',
    isoNumeric: '516', passportIcon: '🏜️' },
  { matchers: [/ethiopia/i, /addis\s*ababa/i], timezone: 'Africa/Addis_Ababa', currency: 'ETB', label: 'Ethiopia',
    isoNumeric: '231', passportIcon: '☕' },

  // ---- Pacific / Oceania ----
  { matchers: [/fiji/i], timezone: 'Pacific/Fiji', currency: 'FJD', label: 'Fiji',
    isoNumeric: '242', passportIcon: '🏖️' },
  { matchers: [/papua\s*new\s*guinea/i, /\bpng\b/i], timezone: 'Pacific/Port_Moresby', currency: 'PGK', label: 'Papua New Guinea',
    isoNumeric: '598', passportIcon: '🦜' },
  { matchers: [/samoa/i], timezone: 'Pacific/Apia', currency: 'WST', label: 'Samoa',
    isoNumeric: '882', passportIcon: '🌺' },
  { matchers: [/tonga/i], timezone: 'Pacific/Tongatapu', currency: 'TOP', label: 'Tonga',
    isoNumeric: '776', passportIcon: '🐋' },
  { matchers: [/french\s*polynesia/i, /tahiti/i, /bora\s*bora/i], timezone: 'Pacific/Tahiti', currency: 'XPF', label: 'French Polynesia',
    isoNumeric: '258', passportIcon: '🏖️' },
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
  // Major reserves
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  CHF: 0.88,

  // Asia-Pacific
  AUD: 1.50,
  NZD: 1.65,
  JPY: 149.32,
  CNY: 7.20,
  HKD: 7.82,
  KRW: 1330,
  TWD: 31.5,
  SGD: 1.35,
  INR: 83.20,
  IDR: 15800,
  VND: 24500,
  THB: 35.40,
  PHP: 56.0,
  MYR: 4.70,
  KHR: 4100,
  LAK: 21000,
  MMK: 2100,
  LKR: 320,
  NPR: 133,
  MVR: 15.4,

  // Middle East
  AED: 3.67,
  ILS: 3.70,
  JOD: 0.71,

  // Americas
  CAD: 1.36,
  MXN: 17.10,
  ARS: 1000,
  BRL: 5.10,
  CLP: 950,
  PEN: 3.75,
  COP: 4000,
  CRC: 520,
  CUP: 24.0,

  // Europe (non-Eur)
  ISK: 138.40,
  CZK: 23.0,
  HUF: 360,
  NOK: 11.0,
  SEK: 11.0,
  DKK: 6.90,
  PLN: 4.00,
  TRY: 33.0,

  // Africa
  ZAR: 18.5,
  MAD: 10.0,
  EGP: 47.0,
  KES: 130,
  TZS: 2500,
  NAD: 18.5,    // pegged to ZAR
  ETB: 120,

  // Pacific
  FJD: 2.25,
  PGK: 3.90,
  WST: 2.70,
  TOP: 2.40,
  XPF: 109,
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

// ----- Currency presentation helpers ------------------------------------------------

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', AUD: '$', NZD: '$', CAD: '$', SGD: '$', HKD: '$', MXN: '$',
  ARS: '$', CLP: '$', COP: '$', CRC: '₡', CUP: '$', FJD: '$', BRL: 'R$',
  EUR: '€', GBP: '£', CHF: 'Fr',
  JPY: '¥', CNY: '¥', KRW: '₩', INR: '₹', THB: '฿', VND: '₫', PHP: '₱',
  IDR: 'Rp', MYR: 'RM', TWD: 'NT$', LKR: 'Rs', NPR: 'Rs', MVR: '.ރ',
  KHR: '៛', LAK: '₭', MMK: 'K',
  AED: 'د.إ', ILS: '₪', JOD: 'JD',
  ISK: 'kr', CZK: 'Kč', HUF: 'Ft', NOK: 'kr', SEK: 'kr', DKK: 'kr',
  PLN: 'zł', TRY: '₺',
  ZAR: 'R', MAD: 'DH', EGP: 'E£', KES: 'KSh', TZS: 'TSh', NAD: '$', ETB: 'Br',
  PGK: 'K', WST: '$', TOP: 'T$', XPF: '₣',
}

/** Currency symbol for a code (falls back to the code itself). */
export function currencySymbol(code: string | null | undefined): string {
  if (!code) return '$'
  return CURRENCY_SYMBOLS[code.toUpperCase()] ?? code.toUpperCase()
}

// Currencies that conventionally have no minor units (no cents).
const ZERO_DECIMAL_CURRENCIES = new Set([
  'JPY', 'KRW', 'VND', 'IDR', 'CLP', 'COP', 'HUF', 'ISK', 'LAK', 'MMK',
  'KHR', 'PYG', 'XPF', 'TZS', 'UGX', 'RWF', 'XAF', 'XOF',
])

/** How many decimal places to show for a currency (0 for yen/won/etc, else 2). */
export function currencyDecimals(code: string | null | undefined): number {
  if (!code) return 2
  return ZERO_DECIMAL_CURRENCIES.has(code.toUpperCase()) ? 0 : 2
}

function niceRound(n: number): number {
  if (n >= 10000) return Math.round(n / 1000) * 1000
  if (n >= 1000) return Math.round(n / 500) * 500
  if (n >= 100) return Math.round(n / 50) * 50
  if (n >= 10) return Math.round(n / 5) * 5
  return Math.max(1, Math.round(n))
}

/**
 * Destination-appropriate quick-amount chips for the currency converter.
 * Scales a set of ~USD reference amounts into the local currency and rounds
 * to clean numbers, so a Japan trip offers ¥1,500 / ¥3,500 / ¥7,500 / ¥15,000
 * while a NZ trip offers $15 / $40 / $85 / $150.
 */
export function currencyQuickAmounts(code: string | null | undefined): number[] {
  const perUsd = code ? (FX_PER_USD[code.toUpperCase()] ?? 1) : 1
  return [10, 25, 50, 100].map((usd) => niceRound(usd * perUsd))
}
