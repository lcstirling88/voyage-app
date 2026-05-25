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
