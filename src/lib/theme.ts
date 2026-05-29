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

// All hero gradients now share the blue-forward identity: a deep Delft→Spanish
// base with a Uranium-blue glow top-left and a Light-Coral glow top-right.
// Per-destination character lives in the motif/scriptLine, not the colours.
const URANIUM_GLOW = 'rgba(127,201,227,0.28)'
const CORAL_GLOW = 'rgba(240,128,128,0.20)'
const BLUE_BASE = 'linear-gradient(180deg, #14224A 0%, #163A6E 55%, #0B6FB8 125%)'
const blueHero = (glowL = URANIUM_GLOW, glowR = CORAL_GLOW) =>
  `radial-gradient(110% 60% at 15% 0%, ${glowL} 0%, transparent 60%), radial-gradient(80% 60% at 92% 12%, ${glowR} 0%, transparent 55%), ${BLUE_BASE}`

export const themes: Record<ThemeKey, CountryTheme> = {
  'japan-autumn': {
    heroGradient: blueHero('rgba(240,128,128,0.26)', 'rgba(127,201,227,0.24)'),
    heroPattern: 'asanoha',
    accentClass: 'bg-sakura',
    accentSoftClass: 'bg-sakura-soft',
    motif: '秋',
    scriptLine: 'Autumn',
  },
  'new-zealand': {
    heroGradient: blueHero(),
    accentClass: 'bg-sage',
    accentSoftClass: 'bg-sage-soft',
    motif: 'NZ',
    scriptLine: 'Aotearoa',
  },
  'italy': {
    heroGradient: blueHero('rgba(240,128,128,0.24)', 'rgba(127,201,227,0.26)'),
    accentClass: 'bg-sakura',
    accentSoftClass: 'bg-sakura-soft',
    motif: 'IT',
    scriptLine: 'Italia',
  },
  'iceland': {
    heroGradient: blueHero('rgba(127,201,227,0.40)', 'rgba(127,201,227,0.20)'),
    accentClass: 'bg-sage',
    accentSoftClass: 'bg-sage-soft',
    motif: 'IS',
    scriptLine: 'Ísland',
  },
  'thailand': {
    heroGradient: blueHero('rgba(127,201,227,0.30)', 'rgba(240,128,128,0.24)'),
    accentClass: 'bg-sage',
    accentSoftClass: 'bg-sage-soft',
    motif: 'TH',
    scriptLine: 'ประเทศไทย',
  },
  'default': {
    heroGradient: blueHero(),
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
