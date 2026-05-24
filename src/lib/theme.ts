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

export const themes: Record<ThemeKey, CountryTheme> = {
  'japan-autumn': {
    heroGradient:
      'radial-gradient(120% 60% at 20% 0%, rgba(216,150,149,0.55) 0%, transparent 60%), radial-gradient(80% 60% at 90% 10%, rgba(168,129,75,0.40) 0%, transparent 55%), linear-gradient(180deg, #1a2027 0%, #2c2018 55%, #3d2820 100%)',
    heroPattern: 'asanoha',
    accentClass: 'bg-sakura',
    accentSoftClass: 'bg-sakura-soft',
    motif: '秋',
    scriptLine: 'Autumn',
  },
  'new-zealand': {
    // Deep alpine night → tussock-gold glow → pohutukawa-red highlight in the corner
    heroGradient:
      'radial-gradient(120% 60% at 15% 0%, rgba(170,75,60,0.32) 0%, transparent 55%), radial-gradient(80% 60% at 92% 12%, rgba(178,138,72,0.38) 0%, transparent 60%), linear-gradient(180deg, #0c1820 0%, #122230 50%, #1d3344 100%)',
    accentClass: 'bg-gold',
    accentSoftClass: 'bg-gold-soft',
    motif: 'NZ',
    scriptLine: 'Aotearoa',
  },
  'italy': {
    heroGradient:
      'radial-gradient(120% 60% at 20% 0%, rgba(229,180,80,0.55) 0%, transparent 60%), radial-gradient(80% 60% at 90% 10%, rgba(140,40,40,0.40) 0%, transparent 55%), linear-gradient(180deg, #2a1810 0%, #3d2218 55%, #5e2c1d 100%)',
    accentClass: 'bg-gold',
    accentSoftClass: 'bg-gold-soft',
    motif: 'IT',
    scriptLine: 'Italia',
  },
  'iceland': {
    heroGradient:
      'radial-gradient(120% 60% at 20% 0%, rgba(180,210,230,0.55) 0%, transparent 60%), radial-gradient(80% 60% at 90% 10%, rgba(80,120,160,0.45) 0%, transparent 55%), linear-gradient(180deg, #0e1a26 0%, #1a2a3a 55%, #2c4458 100%)',
    accentClass: 'bg-sage',
    accentSoftClass: 'bg-sage-soft',
    motif: 'IS',
    scriptLine: 'Ísland',
  },
  'thailand': {
    heroGradient:
      'radial-gradient(120% 60% at 20% 0%, rgba(240,200,90,0.55) 0%, transparent 60%), radial-gradient(80% 60% at 90% 10%, rgba(140,70,40,0.45) 0%, transparent 55%), linear-gradient(180deg, #1f1010 0%, #3a1c14 55%, #5e2e18 100%)',
    accentClass: 'bg-gold',
    accentSoftClass: 'bg-gold-soft',
    motif: 'TH',
    scriptLine: 'ประเทศไทย',
  },
  'default': {
    heroGradient:
      'radial-gradient(80% 50% at 15% 0%, rgba(63,91,78,0.45) 0%, transparent 60%), linear-gradient(180deg, #1a1f1d 0%, #2a3530 100%)',
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
