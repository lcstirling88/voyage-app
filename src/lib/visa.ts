/**
 * Shape of the AI-generated visa/entry blob stored on Trip.visaInfoJson.
 * Generated per the trip owner's passport, one entry per destination country.
 * Always presented with a "verify with official sources" disclaimer — this
 * is guidance, not legal advice.
 */

export type VisaStatus =
  | 'visa-free' | 'eta' | 'evisa' | 'visa-on-arrival' | 'visa-required' | 'unknown'

export type VisaCountryInfo = {
  country: string
  isoNumeric: string | null
  status: VisaStatus
  /** Days allowed visa-free / on the visa, or null if N/A. */
  allowedStayDays: number | null
  summary: string
  requirements: string[]
  passportValidityRule: string | null
}

export type VisaInfo = {
  generatedAt: string
  passportIso: string
  passportLabel: string
  countries: VisaCountryInfo[]
}

export function safeParseVisaInfo(json: string | null | undefined): VisaInfo | null {
  if (!json) return null
  try {
    const parsed = JSON.parse(json) as VisaInfo
    if (!Array.isArray(parsed.countries)) return null
    return parsed
  } catch {
    return null
  }
}

/** UI presentation for each visa status: short label + pill class + tone. */
export function visaStatusDisplay(status: VisaStatus): { label: string; pill: string } {
  switch (status) {
    case 'visa-free':       return { label: 'Visa-free', pill: 'pill-paid' }
    case 'eta':             return { label: 'ETA required', pill: 'pill-info' }
    case 'evisa':           return { label: 'eVisa required', pill: 'pill-info' }
    case 'visa-on-arrival': return { label: 'Visa on arrival', pill: 'pill-upcoming' }
    case 'visa-required':   return { label: 'Visa required — apply ahead', pill: 'pill-overdue' }
    default:                return { label: 'Check requirements', pill: 'pill-info' }
  }
}
