/**
 * Shape of the AI-generated local-info blob stored on Trip.localInfoJson.
 * Generated once via Claude for any destination; replaces the hardcoded
 * Japan-only content that used to live in the Local Info page.
 */

export type LocalInfo = {
  generatedAt: string                                                 // ISO timestamp
  destination: string                                                 // What was queried
  tipping:        { summary: string; rules: string[] }
  power:          { type: string; voltage: string; frequency: string; notes: string[] }
  cashVsCard:     { summary: string; notes: string[] }
  connectivity:   { summary: string; notes: string[] }
  phrases:        Array<{ phrase: string; translation: string }>
  dontDoThis:     string[]
  emergencyNumbers: Array<{ label: string; number: string }>
  ruleOfThumbCurrency?: string                                        // e.g. "drop the last digit of NZD for AUD"
}

export function safeParseLocalInfo(json: string | null | undefined): LocalInfo | null {
  if (!json) return null
  try {
    const parsed = JSON.parse(json) as LocalInfo
    if (!parsed.tipping || !parsed.phrases) return null
    return parsed
  } catch {
    return null
  }
}

// Multi-country: one LocalInfo section per country leg. Stored on
// Trip.localInfoJson as { generatedAt, countries: [...] }. The parser also
// accepts the OLD single-blob format and wraps it as one country, so trips
// generated before multi-country still render.
export type LocalInfoCountry = { country: string; isoNumeric: string | null; info: LocalInfo }
export type LocalInfoSet = { generatedAt: string; countries: LocalInfoCountry[] }

export function safeParseLocalInfoSet(json: string | null | undefined): LocalInfoSet | null {
  if (!json) return null
  try {
    const parsed = JSON.parse(json) as Record<string, unknown>
    const maybeCountries = parsed.countries
    if (Array.isArray(maybeCountries)) {
      const countries = maybeCountries.filter(
        (c): c is LocalInfoCountry =>
          !!(c as LocalInfoCountry)?.info?.tipping && !!(c as LocalInfoCountry)?.info?.phrases,
      )
      return countries.length ? { generatedAt: String(parsed.generatedAt ?? ''), countries } : null
    }
    // Old single-blob format → wrap as one country.
    const single = parsed as unknown as LocalInfo
    if (single.tipping && single.phrases) {
      return {
        generatedAt: single.generatedAt ?? '',
        countries: [{ country: single.destination ?? '', isoNumeric: null, info: single }],
      }
    }
    return null
  } catch {
    return null
  }
}
