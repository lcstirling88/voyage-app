/**
 * Brand exploration — a throwaway preview page (/brand) to choose a new
 * blue-forward palette, a logo direction, and a typeface pairing before
 * applying any of it across the app. Not linked in nav; just visit /brand.
 */

import { Fraunces, Playfair_Display, Space_Grotesk, Outfit } from 'next/font/google'

const fraunces = Fraunces({ subsets: ['latin'], weight: ['400', '500', '600'] })
const playfair = Playfair_Display({ subsets: ['latin'], weight: ['400', '600', '700'] })
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], weight: ['400', '500', '700'] })
const outfit = Outfit({ subsets: ['latin'], weight: ['300', '500', '700'] })

// Requested palette
const URANIUM = '#7FC9E3'
const SPANISH = '#0B6FB8'
const DELFT = '#1B2A55'
const CORAL = '#F08080'
const TEAROSE = '#F4C2C2'
const BG = '#F5F9FC'
const INK = '#1B2A55'

const SWATCHES = [
  { name: 'Uranium Blue', hex: URANIUM, role: 'Light / airy highlights' },
  { name: 'Spanish Blue', hex: SPANISH, role: 'Primary actions' },
  { name: 'Delft Blue', hex: DELFT, role: 'Text + dark surfaces' },
  { name: 'Light Coral', hex: CORAL, role: 'Accent — option 1' },
  { name: 'Tea Rose', hex: TEAROSE, role: 'Accent — option 2' },
  { name: 'Mist', hex: BG, role: 'Page background' },
]

// ---- Logo marks -----------------------------------------------------------

function MarkArc({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden>
      <path d="M9 37 Q24 7 39 37" stroke={SPANISH} strokeWidth="2.5" strokeLinecap="round" strokeDasharray="0.5 5" />
      <circle cx="9" cy="37" r="3.5" fill={DELFT} />
      <circle cx="39" cy="37" r="3.5" fill={CORAL} />
    </svg>
  )
}

function MarkCompass({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden>
      <circle cx="24" cy="24" r="19" stroke={SPANISH} strokeWidth="2" />
      <path d="M24 8 L27.5 24 L24 40 L20.5 24 Z" fill={DELFT} />
      <path d="M8 24 L24 20.5 L40 24 L24 27.5 Z" fill={CORAL} />
    </svg>
  )
}

function MarkMeridian({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden>
      <circle cx="24" cy="24" r="18" stroke={SPANISH} strokeWidth="2.5" />
      <ellipse cx="24" cy="24" rx="7.5" ry="18" stroke={URANIUM} strokeWidth="1.5" />
      <line x1="24" y1="5" x2="24" y2="43" stroke={DELFT} strokeWidth="2.5" />
      <circle cx="24" cy="24" r="2.5" fill={CORAL} />
    </svg>
  )
}

function MarkWaypoint({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden>
      <path d="M24 5c8 0 13.5 6 13.5 13.6C37.5 28 24 43 24 43S10.5 28 10.5 18.6C10.5 11 16 5 24 5Z" fill={SPANISH} />
      <circle cx="24" cy="18.5" r="5.5" fill={URANIUM} />
    </svg>
  )
}

const LOGO_OPTIONS = [
  { id: 'A', name: 'Journey arc', note: 'Dotted flight path — origin (navy) to destination (coral). Playful, literal.', Mark: MarkArc },
  { id: 'B', name: 'Compass', note: 'Classic travel mark; the cross-needle nods to direction.', Mark: MarkCompass },
  { id: 'C', name: 'Meridian', note: 'Globe + axis reads as a quiet “I”. Geographic, modern.', Mark: MarkMeridian },
  { id: 'D', name: 'Waypoint', note: 'A clean location pin with a bright centre.', Mark: MarkWaypoint },
] as const

const FONT_OPTIONS = [
  { font: fraunces, name: 'Fraunces', note: 'Current — warm editorial serif. High character.' },
  { font: playfair, name: 'Playfair Display', note: 'High-contrast serif. Elegant, fashion-magazine.' },
  { font: spaceGrotesk, name: 'Space Grotesk', note: 'Modern grotesque. Techy, confident — suits the blues.' },
  { font: outfit, name: 'Outfit', note: 'Geometric sans. Clean, friendly, contemporary.' },
] as const

function Wordmark({ className = '', color = DELFT }: { className?: string; color?: string }) {
  return <span className={className} style={{ color }}>Itinera</span>
}

export default function BrandPage() {
  return (
    <main style={{ background: BG, color: INK }} className="min-h-dvh">
      <div className="max-w-5xl mx-auto px-5 sm:px-10 py-10 sm:py-16 space-y-16">
        <header>
          <div className="text-[11px] uppercase tracking-[0.28em]" style={{ color: SPANISH }}>Brand exploration</div>
          <h1 className={`${fraunces.className} text-4xl sm:text-6xl mt-2`} style={{ color: DELFT }}>
            A bluer Itinera.
          </h1>
          <p className="mt-3 text-sm sm:text-base max-w-xl" style={{ color: '#4A5A7A' }}>
            Pick a palette accent, a logo direction, and a typeface. Tell me the combo you like and I&apos;ll roll it across the whole app.
          </p>
        </header>

        {/* Palette */}
        <section>
          <h2 className={`${fraunces.className} text-2xl sm:text-3xl mb-5`} style={{ color: DELFT }}>Palette</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {SWATCHES.map((s) => (
              <div key={s.name} className="rounded-2xl overflow-hidden border" style={{ borderColor: '#DCE6F0', background: '#fff' }}>
                <div style={{ background: s.hex, height: 84 }} />
                <div className="p-3">
                  <div className="text-sm font-medium" style={{ color: DELFT }}>{s.name}</div>
                  <div className="text-[11px] num-mono" style={{ color: '#7A89A6' }}>{s.hex}</div>
                  <div className="text-[11px] mt-1" style={{ color: '#7A89A6' }}>{s.role}</div>
                </div>
              </div>
            ))}
          </div>

          {/* In context */}
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Dark surface */}
            <div className="rounded-2xl p-6" style={{ background: DELFT }}>
              <div className="text-[10px] uppercase tracking-[0.24em]" style={{ color: URANIUM }}>New Zealand 2026</div>
              <div className={`${fraunces.className} text-3xl mt-2`} style={{ color: '#fff' }}>20 days to go.</div>
              <div className="mt-4 flex gap-2">
                <span className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: SPANISH, color: '#fff' }}>Primary</span>
                <span className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: CORAL, color: DELFT }}>Coral accent</span>
                <span className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: TEAROSE, color: DELFT }}>Tea rose</span>
              </div>
            </div>
            {/* Light surface */}
            <div className="rounded-2xl p-6 border" style={{ background: '#fff', borderColor: '#DCE6F0' }}>
              <div className="text-[10px] uppercase tracking-[0.24em]" style={{ color: SPANISH }}>Costs &amp; Payments</div>
              <div className={`${fraunces.className} text-3xl mt-2`} style={{ color: DELFT }}>61% paid</div>
              <div className="h-1.5 rounded-full mt-3 overflow-hidden" style={{ background: '#E3ECF5' }}>
                <div style={{ width: '61%', height: '100%', background: SPANISH }} />
              </div>
              <div className="mt-4 flex gap-2">
                <span className="px-3 py-1.5 rounded-full text-xs" style={{ background: URANIUM + '33', color: SPANISH }}>Uranium tint</span>
                <span className="px-3 py-1.5 rounded-full text-xs" style={{ background: CORAL + '22', color: '#B5524F' }}>Coral tint</span>
              </div>
            </div>
          </div>
        </section>

        {/* Logos */}
        <section>
          <h2 className={`${fraunces.className} text-2xl sm:text-3xl mb-5`} style={{ color: DELFT }}>Logo options</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {LOGO_OPTIONS.map(({ id, name, note, Mark }) => (
              <div key={id} className="rounded-2xl border overflow-hidden" style={{ borderColor: '#DCE6F0', background: '#fff' }}>
                <div className="p-6 flex items-center gap-3">
                  <Mark size={44} />
                  <span className={`${fraunces.className} text-3xl`} style={{ color: DELFT }}>Itinera</span>
                </div>
                <div className="px-6 py-4 flex items-center gap-3" style={{ background: DELFT }}>
                  <Mark size={32} />
                  <span className={`${fraunces.className} text-2xl`} style={{ color: '#fff' }}>Itinera</span>
                </div>
                <div className="p-4">
                  <div className="text-sm font-medium" style={{ color: DELFT }}>Option {id} · {name}</div>
                  <div className="text-[12px] mt-0.5" style={{ color: '#7A89A6' }}>{note}</div>
                </div>
              </div>
            ))}
            {/* Wordmark only */}
            <div className="rounded-2xl border overflow-hidden sm:col-span-2" style={{ borderColor: '#DCE6F0', background: '#fff' }}>
              <div className="p-8 text-center">
                <span className={`${fraunces.className} text-5xl tracking-tight`} style={{ color: DELFT }}>Itinera</span>
                <span style={{ color: CORAL }} className="text-5xl">.</span>
              </div>
              <div className="p-4">
                <div className="text-sm font-medium" style={{ color: DELFT }}>Option E · Wordmark only</div>
                <div className="text-[12px] mt-0.5" style={{ color: '#7A89A6' }}>No mark — just the name with a coral full-stop. Most editorial / grown-up.</div>
              </div>
            </div>
          </div>
        </section>

        {/* Fonts */}
        <section>
          <h2 className={`${fraunces.className} text-2xl sm:text-3xl mb-5`} style={{ color: DELFT }}>Typeface options</h2>
          <div className="space-y-4">
            {FONT_OPTIONS.map(({ font, name, note }) => (
              <div key={name} className="rounded-2xl border p-6" style={{ borderColor: '#DCE6F0', background: '#fff' }}>
                <div className="flex items-baseline justify-between gap-3 flex-wrap">
                  <span className={`${font.className} text-4xl sm:text-5xl`} style={{ color: DELFT }}>Itinera</span>
                  <span className="text-[11px] num-mono" style={{ color: '#7A89A6' }}>{name}</span>
                </div>
                <p className={`${font.className} text-lg mt-2`} style={{ color: SPANISH }}>The art of the journey.</p>
                <p className={`${font.className} text-sm mt-3`} style={{ color: '#4A5A7A' }}>
                  Forward a booking email and Itinera files it onto your trip — flights, hotels, the lot.
                </p>
                <div className="text-[12px] mt-3" style={{ color: '#7A89A6' }}>{note}</div>
              </div>
            ))}
          </div>
        </section>

        <footer className="text-center text-xs pt-6" style={{ color: '#7A89A6' }}>
          Tell me e.g. “Spanish-blue primary, coral accent, Option C logo, Space Grotesk” and I&apos;ll apply it everywhere.
        </footer>
      </div>
    </main>
  )
}
