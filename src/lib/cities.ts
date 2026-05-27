/**
 * City → IANA timezone resolver.
 *
 * The destinations registry handles country-level lookups (used to derive
 * the destination clock for the whole trip). This file is the city-level
 * companion: given a free-text city name like "Brisbane" or "San Francisco",
 * return the right timezone so we can show the user a home-city clock
 * alongside the destination clock in the top bar.
 *
 * Coverage: Australia + NZ in full (the app's home audience), then major
 * travel hubs across the world. Unknown cities return null and the home
 * clock is silently hidden — better no clock than a wrong clock.
 */

type CityEntry = {
  matchers: RegExp[]
  timezone: string
}

const CITY_ENTRIES: CityEntry[] = [
  // Australia — every capital + major regional hub
  { matchers: [/\bbrisbane\b/i],                timezone: 'Australia/Brisbane' },
  { matchers: [/\bsydney\b/i],                  timezone: 'Australia/Sydney' },
  { matchers: [/\bmelbourne\b/i],               timezone: 'Australia/Melbourne' },
  { matchers: [/\bperth\b/i],                   timezone: 'Australia/Perth' },
  { matchers: [/\badelaide\b/i],                timezone: 'Australia/Adelaide' },
  { matchers: [/\bhobart\b/i],                  timezone: 'Australia/Hobart' },
  { matchers: [/\bdarwin\b/i],                  timezone: 'Australia/Darwin' },
  { matchers: [/\bcanberra\b/i],                timezone: 'Australia/Sydney' }, // ACT uses NSW
  { matchers: [/\bgold\s*coast\b/i],            timezone: 'Australia/Brisbane' },
  { matchers: [/\bcairns\b/i],                  timezone: 'Australia/Brisbane' },
  { matchers: [/\bnewcastle\b/i],               timezone: 'Australia/Sydney' },

  // New Zealand
  { matchers: [/\bauckland\b/i],                timezone: 'Pacific/Auckland' },
  { matchers: [/\bwellington\b/i],              timezone: 'Pacific/Auckland' },
  { matchers: [/\bchristchurch\b/i],            timezone: 'Pacific/Auckland' },
  { matchers: [/\bqueenstown\b/i],              timezone: 'Pacific/Auckland' },
  { matchers: [/\brotorua\b/i],                 timezone: 'Pacific/Auckland' },

  // Japan
  { matchers: [/\btokyo\b/i],                   timezone: 'Asia/Tokyo' },
  { matchers: [/\bosaka\b/i],                   timezone: 'Asia/Tokyo' },
  { matchers: [/\bkyoto\b/i],                   timezone: 'Asia/Tokyo' },

  // US — coast + major hubs
  { matchers: [/\bnew\s*york\b|\bnyc\b/i],      timezone: 'America/New_York' },
  { matchers: [/\bboston\b/i],                  timezone: 'America/New_York' },
  { matchers: [/\bmiami\b/i],                   timezone: 'America/New_York' },
  { matchers: [/\bwashington\b/i],              timezone: 'America/New_York' },
  { matchers: [/\bchicago\b/i],                 timezone: 'America/Chicago' },
  { matchers: [/\bdenver\b/i],                  timezone: 'America/Denver' },
  { matchers: [/\blos\s*angeles\b|\bla\b/i],    timezone: 'America/Los_Angeles' },
  { matchers: [/\bsan\s*francisco\b|\bsf\b/i],  timezone: 'America/Los_Angeles' },
  { matchers: [/\bseattle\b/i],                 timezone: 'America/Los_Angeles' },

  // Canada
  { matchers: [/\btoronto\b/i],                 timezone: 'America/Toronto' },
  { matchers: [/\bvancouver\b/i],               timezone: 'America/Vancouver' },
  { matchers: [/\bmontreal\b/i],                timezone: 'America/Toronto' },

  // UK & Ireland
  { matchers: [/\blondon\b/i],                  timezone: 'Europe/London' },
  { matchers: [/\bedinburgh\b/i],               timezone: 'Europe/London' },
  { matchers: [/\bmanchester\b/i],              timezone: 'Europe/London' },
  { matchers: [/\bdublin\b/i],                  timezone: 'Europe/Dublin' },

  // EU
  { matchers: [/\bparis\b/i],                   timezone: 'Europe/Paris' },
  { matchers: [/\brome\b/i],                    timezone: 'Europe/Rome' },
  { matchers: [/\bmilan\b/i],                   timezone: 'Europe/Rome' },
  { matchers: [/\bvenice\b/i],                  timezone: 'Europe/Rome' },
  { matchers: [/\bberlin\b/i],                  timezone: 'Europe/Berlin' },
  { matchers: [/\bmunich\b/i],                  timezone: 'Europe/Berlin' },
  { matchers: [/\bmadrid\b|\bbarcelona\b/i],    timezone: 'Europe/Madrid' },
  { matchers: [/\blisbon\b|\bporto\b/i],        timezone: 'Europe/Lisbon' },
  { matchers: [/\bamsterdam\b/i],               timezone: 'Europe/Amsterdam' },
  { matchers: [/\bvienna\b/i],                  timezone: 'Europe/Vienna' },
  { matchers: [/\bathens\b/i],                  timezone: 'Europe/Athens' },
  { matchers: [/\bcopenhagen\b/i],              timezone: 'Europe/Copenhagen' },
  { matchers: [/\bstockholm\b/i],               timezone: 'Europe/Stockholm' },
  { matchers: [/\boslo\b/i],                    timezone: 'Europe/Oslo' },
  { matchers: [/\bhelsinki\b/i],                timezone: 'Europe/Helsinki' },
  { matchers: [/\breykjav(i|í)k\b/i],            timezone: 'Atlantic/Reykjavik' },

  // Asia hubs
  { matchers: [/\bsingapore\b/i],               timezone: 'Asia/Singapore' },
  { matchers: [/\bbangkok\b/i],                 timezone: 'Asia/Bangkok' },
  { matchers: [/\bhong\s*kong\b/i],             timezone: 'Asia/Hong_Kong' },
  { matchers: [/\bseoul\b/i],                   timezone: 'Asia/Seoul' },
  { matchers: [/\btaipei\b/i],                  timezone: 'Asia/Taipei' },
  { matchers: [/\bmumbai\b|\bdelhi\b/i],        timezone: 'Asia/Kolkata' },
  { matchers: [/\bbali\b|\bjakarta\b/i],        timezone: 'Asia/Jakarta' },
  { matchers: [/\bmanila\b/i],                  timezone: 'Asia/Manila' },
  { matchers: [/\bkuala\s*lumpur\b|\bkl\b/i],   timezone: 'Asia/Kuala_Lumpur' },

  // Middle East
  { matchers: [/\bdubai\b/i],                   timezone: 'Asia/Dubai' },
  { matchers: [/\bdoha\b/i],                    timezone: 'Asia/Qatar' },
  { matchers: [/\bistanbul\b/i],                timezone: 'Europe/Istanbul' },

  // Other
  { matchers: [/\bmexico\s*city\b/i],           timezone: 'America/Mexico_City' },
  { matchers: [/\bbuenos\s*aires\b/i],          timezone: 'America/Argentina/Buenos_Aires' },
  { matchers: [/\brio\b|\bs(a|ã)o\s*paulo\b/i], timezone: 'America/Sao_Paulo' },
  { matchers: [/\bcape\s*town\b/i],             timezone: 'Africa/Johannesburg' },
  { matchers: [/\bjohannesburg\b/i],            timezone: 'Africa/Johannesburg' },
  { matchers: [/\bnairobi\b/i],                 timezone: 'Africa/Nairobi' },
]

/**
 * Resolve a free-text city name to an IANA timezone. Returns null if
 * nothing matched — caller should hide the home clock rather than guess.
 */
export function timezoneForCity(cityName: string | null | undefined): string | null {
  if (!cityName) return null
  for (const entry of CITY_ENTRIES) {
    if (entry.matchers.some((r) => r.test(cityName))) return entry.timezone
  }
  return null
}

/** Convert an IANA timezone string ("Australia/Brisbane") to a friendly label
 *  ("Brisbane"). Strips the region prefix + un-snake-cases the city. */
export function labelFromTimezone(timezone: string, fallback = ''): string {
  if (timezone.includes('/')) {
    return timezone.split('/').pop()!.replace(/_/g, ' ')
  }
  return fallback
}
