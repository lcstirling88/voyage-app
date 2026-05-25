/**
 * Destination registry — given a free-text destination string ("New Zealand",
 * "Japan", "Italy"), derive sensible defaults for timezone, local currency,
 * and approximate FX rate to the home currency.
 *
 * Used at trip create / edit time to populate Trip.timezone + Trip.localCurrency.
 * Real-time FX should pull from an API; the table below is a fallback for the prototype.
 */

export type DestinationProfile = {
  /** Matchers for the user's free-text destination input */
  matchers: RegExp[]
  /** IANA timezone string */
  timezone: string
  /** ISO 4217 currency code */
  currency: string
  /** Friendly label */
  label: string
}

const PROFILES: DestinationProfile[] = [
  { matchers: [/japan/i, /日本/], timezone: 'Asia/Tokyo', currency: 'JPY', label: 'Japan' },
  { matchers: [/new\s*zealand/i, /\baotearoa\b/i, /\bnz\b/i], timezone: 'Pacific/Auckland', currency: 'NZD', label: 'New Zealand' },
  { matchers: [/australia/i, /\bau\b/i], timezone: 'Australia/Sydney', currency: 'AUD', label: 'Australia' },
  { matchers: [/italy/i, /italia/i], timezone: 'Europe/Rome', currency: 'EUR', label: 'Italy' },
  { matchers: [/iceland/i, /ísland/i], timezone: 'Atlantic/Reykjavik', currency: 'ISK', label: 'Iceland' },
  { matchers: [/thailand/i, /siam/i], timezone: 'Asia/Bangkok', currency: 'THB', label: 'Thailand' },
  { matchers: [/france/i], timezone: 'Europe/Paris', currency: 'EUR', label: 'France' },
  { matchers: [/spain/i, /españa/i], timezone: 'Europe/Madrid', currency: 'EUR', label: 'Spain' },
  { matchers: [/germany/i, /deutschland/i], timezone: 'Europe/Berlin', currency: 'EUR', label: 'Germany' },
  { matchers: [/portugal/i], timezone: 'Europe/Lisbon', currency: 'EUR', label: 'Portugal' },
  { matchers: [/united\s*kingdom/i, /\buk\b/i, /england/i, /scotland/i, /wales/i], timezone: 'Europe/London', currency: 'GBP', label: 'United Kingdom' },
  { matchers: [/ireland/i, /éire/i], timezone: 'Europe/Dublin', currency: 'EUR', label: 'Ireland' },
  { matchers: [/united\s*states/i, /\busa\b/i, /\bus\b/i, /america/i], timezone: 'America/New_York', currency: 'USD', label: 'United States' },
  { matchers: [/canada/i], timezone: 'America/Toronto', currency: 'CAD', label: 'Canada' },
  { matchers: [/mexico/i, /méxico/i], timezone: 'America/Mexico_City', currency: 'MXN', label: 'Mexico' },
  { matchers: [/singapore/i], timezone: 'Asia/Singapore', currency: 'SGD', label: 'Singapore' },
  { matchers: [/indonesia/i, /bali/i], timezone: 'Asia/Jakarta', currency: 'IDR', label: 'Indonesia' },
  { matchers: [/vietnam/i], timezone: 'Asia/Ho_Chi_Minh', currency: 'VND', label: 'Vietnam' },
  { matchers: [/south\s*korea/i, /\bkorea\b/i], timezone: 'Asia/Seoul', currency: 'KRW', label: 'South Korea' },
  { matchers: [/china/i, /中国/i], timezone: 'Asia/Shanghai', currency: 'CNY', label: 'China' },
  { matchers: [/hong\s*kong/i], timezone: 'Asia/Hong_Kong', currency: 'HKD', label: 'Hong Kong' },
  { matchers: [/india/i], timezone: 'Asia/Kolkata', currency: 'INR', label: 'India' },
]

const FALLBACK: Omit<DestinationProfile, 'matchers'> = {
  timezone: 'UTC',
  currency: 'USD',
  label: 'Unknown',
}

export function profileForDestination(destination: string | null | undefined): Omit<DestinationProfile, 'matchers'> {
  if (!destination) return FALLBACK
  for (const p of PROFILES) {
    if (p.matchers.some((r) => r.test(destination))) {
      return { timezone: p.timezone, currency: p.currency, label: p.label }
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
