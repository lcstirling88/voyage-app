export type ThemeKey =
  | 'japan-autumn'
  | 'new-zealand'
  | 'italy'
  | 'iceland'
  | 'thailand'
  | 'default'

export interface CountryTheme {
  heroGradient: string
  heroPattern?: string
  accentClass: string
  accentSoftClass: string
  motif?: string
  scriptLine?: string
}

// All hero gradients share the Red Centre identity: a deep umber→sienna→
// terracotta base lit by a desert-ochre glow top-left and a spinifex-sage
// glow top-right. Per-destination character lives in the motif/scriptLine.
const OCHRE_GLOW = 'rgba(212,161,76,0.26)'
const SAGE_GLOW = 'rgba(143,154,102,0.20)'
const EARTH_BASE = 'linear-gradient(180deg, #2A1A12 0%, #5A3322 55%, #A8572F 125%)'
const earthHero = (glowL = OCHRE_GLOW, glowR = SAGE_GLOW) =>
  `radial-gradient(110% 60% at 15% 0%, ${glowL} 0%, transparent 60%), radial-gradient(80% 60% at 92% 12%, ${glowR} 0%, transparent 55%), ${EARTH_BASE}`

export const themes: Record<ThemeKey, CountryTheme> = {
  'japan-autumn': {
    heroGradient: earthHero('rgba(143,154,102,0.24)', 'rgba(212,161,76,0.22)'),
    heroPattern: 'asanoha',
    accentClass: 'bg-sakura',
    accentSoftClass: 'bg-sakura-soft',
    motif: '秋',
    scriptLine: 'Autumn',
  },
  'new-zealand': {
    heroGradient: earthHero(),
    accentClass: 'bg-sage',
    accentSoftClass: 'bg-sage-soft',
    motif: 'NZ',
    scriptLine: 'Aotearoa',
  },
  'italy': {
    heroGradient: earthHero('rgba(212,161,76,0.26)', 'rgba(143,154,102,0.20)'),
    accentClass: 'bg-sakura',
    accentSoftClass: 'bg-sakura-soft',
    motif: 'IT',
    scriptLine: 'Italia',
  },
  'iceland': {
    heroGradient: earthHero('rgba(143,154,102,0.30)', 'rgba(143,154,102,0.18)'),
    accentClass: 'bg-sage',
    accentSoftClass: 'bg-sage-soft',
    motif: 'IS',
    scriptLine: 'Ísland',
  },
  'thailand': {
    heroGradient: earthHero('rgba(143,154,102,0.28)', 'rgba(212,161,76,0.24)'),
    accentClass: 'bg-sage',
    accentSoftClass: 'bg-sage-soft',
    motif: 'TH',
    scriptLine: 'ประเทศไทย',
  },
  'default': {
    heroGradient: earthHero(),
    accentClass: 'bg-sage',
    accentSoftClass: 'bg-sage-soft',
  },
}

export function getTheme(key: string | null | undefined): CountryTheme {
  if (key && key in themes) return themes[key as ThemeKey]
  return themes.default
}

export function deriveThemeFromDestination(destination: string): ThemeKey {
  const d = destination.toLowerCase()
  if (d.includes('japan') || d.includes('日本')) return 'japan-autumn'
  if (d.includes('new zealand') || /\bnz\b/.test(d) || d.includes('aotearoa')) return 'new-zealand'
  if (d.includes('italy') || d.includes('italia')) return 'italy'
  if (d.includes('iceland') || d.includes('ísland')) return 'iceland'
  if (d.includes('thailand') || d.includes('siam')) return 'thailand'
  return 'default'
}

export const themeOptions: { value: ThemeKey; label: string }[] = [
  { value: 'japan-autumn', label: 'Japan (sakura / autumn)' },
  { value: 'new-zealand',  label: 'New Zealand (alpine night)' },
  { value: 'italy',        label: 'Italy (sunset terracotta)' },
  { value: 'iceland',      label: 'Iceland (cold blue)' },
  { value: 'thailand',     label: 'Thailand (gold + earth)' },
  { value: 'default',      label: 'Neutral (sage)' },
]
