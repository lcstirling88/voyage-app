/**
 * Colour-direction explorer — nature-linked palettes for the next rebrand.
 * A throwaway decision page (like /brand): browse the options, then tell me
 * which direction to take the whole app. Public route (auth.ts only gates
 * /trips), so it opens on phone or app without signing in.
 *
 * Each card shows the palette APPLIED (wordmark + heading + button + chips)
 * over a labelled swatch row, so the feel reads in context — not just hex.
 */

import Link from 'next/link'
import { ChevronLeft, Leaf } from 'lucide-react'
import { ItineraBrand } from '@/components/ItineraBrand'

type Palette = {
  id: string
  name: string
  note: string
  ink: string        // headings / primary text
  inkMuted: string   // secondary text
  primary: string    // buttons, links, primary fills
  secondary: string  // supporting deep tone
  accent: string     // the pop — wordmark full stop, pills, highlights
  surface: string    // page / card background
  line: string       // hairline borders
}

const PALETTES: Palette[] = [
  {
    id: 'eucalypt',
    name: 'Eucalypt',
    note: 'Forest greens, dry-grass gold and warm sand — the Australian bush.',
    ink: '#233029', inkMuted: '#5C6A60', primary: '#41705A', secondary: '#2B4A3A',
    accent: '#D2A14C', surface: '#F6F2E8', line: '#E6DEC9',
  },
  {
    id: 'reef',
    name: 'Reef',
    note: 'Deep ocean teal and turquoise, lit by a warm coral catch-light.',
    ink: '#0F3343', inkMuted: '#4F6E79', primary: '#1B7C8B', secondary: '#0D5364',
    accent: '#EA8567', surface: '#EEF6F5', line: '#D5E5E3',
  },
  {
    id: 'red-centre',
    name: 'Red Centre',
    note: 'Outback terracotta and ochre, cooled by spinifex sage.',
    ink: '#33241B', inkMuted: '#7A6353', primary: '#B5633C', secondary: '#6E3A28',
    accent: '#8F9A66', surface: '#F5ECDC', line: '#E7D8C2',
  },
  {
    id: 'wildflower',
    name: 'Wildflower',
    note: 'Native heath pinks against bushland green and pale petal.',
    ink: '#2E2930', inkMuted: '#6C6370', primary: '#C16585', secondary: '#3E5A45',
    accent: '#E29AAC', surface: '#FAF2F2', line: '#EFD9DE',
  },
  {
    id: 'coastal-dune',
    name: 'Coastal Dune',
    note: 'Soft sand, sea-glass and a washed sky blue. Calm and airy.',
    ink: '#34373A', inkMuted: '#6D7378', primary: '#51789A', secondary: '#8DA89E',
    accent: '#E0A88E', surface: '#F7F2E8', line: '#E6DECB',
  },
  {
    id: 'wild-coast',
    name: 'Wild Coast',
    note: 'The whole landscape at once — bush green, ocean blue, sand, and a flowering-pink full stop.',
    ink: '#213A33', inkMuted: '#5E726B', primary: '#2F7C6B', secondary: '#3C6E86',
    accent: '#DB8BA1', surface: '#F4F1E7', line: '#E1DBCA',
  },
]

function Swatch({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="h-10 rounded-md border border-black/5" style={{ background: color }} />
      <div className="text-[9px] uppercase tracking-[0.14em] text-ink-muted">{label}</div>
      <div className="text-[10px] text-ink-muted/70">{color}</div>
    </div>
  )
}

function PaletteCard({ p }: { p: Palette }) {
  return (
    <div className="border border-line rounded-2xl overflow-hidden bg-paper-pure">
      {/* Applied preview — the palette in context */}
      <div className="p-6 sm:p-8" style={{ background: p.surface }}>
        <div className="font-display text-2xl" style={{ color: p.ink }}>
          Itinera<span style={{ color: p.accent }}>.</span>
        </div>
        <div className="font-display text-xl sm:text-2xl mt-4 leading-snug" style={{ color: p.ink }}>
          Every journey, gathered.
        </div>
        <p className="text-sm mt-1.5 leading-relaxed" style={{ color: p.inkMuted }}>
          Forward your bookings — Itinera files the rest.
        </p>
        <div className="flex items-center gap-3 mt-5">
          <span
            className="text-xs px-4 py-2 rounded-full font-medium"
            style={{ background: p.primary, color: '#FFFFFF' }}
          >
            Start a trip
          </span>
          <span
            className="text-[11px] uppercase tracking-[0.12em] px-3 py-1.5 rounded-full font-medium"
            style={{ background: p.secondary, color: '#FFFFFF' }}
          >
            12 days
          </span>
          <span
            className="w-7 h-7 rounded-full shrink-0 border border-black/5"
            style={{ background: p.accent }}
            aria-hidden
          />
        </div>
      </div>

      {/* Name + swatches */}
      <div className="p-5 sm:p-6 border-t border-line">
        <h2 className="font-display text-xl">{p.name}</h2>
        <p className="text-xs text-ink-muted mt-1 leading-relaxed">{p.note}</p>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5 mt-4">
          <Swatch color={p.ink} label="Ink" />
          <Swatch color={p.primary} label="Primary" />
          <Swatch color={p.secondary} label="Second" />
          <Swatch color={p.accent} label="Accent" />
          <Swatch color={p.surface} label="Surface" />
          <Swatch color={p.line} label="Line" />
        </div>
      </div>
    </div>
  )
}

export default function PalettesPage() {
  return (
    <main className="min-h-screen bg-paper-pure">
      <header className="border-b border-line px-5 sm:px-10 py-4 flex items-center justify-between">
        <Link href="/" className="text-xs text-ink-muted hover:text-ink ulink inline-flex items-center gap-1.5">
          <ChevronLeft className="w-3.5 h-3.5" /> Home
        </Link>
        <Link href="/" aria-label="Home">
          <ItineraBrand size="sm" />
        </Link>
        <div className="w-12" />
      </header>

      <div className="max-w-5xl mx-auto px-5 sm:px-10 py-8 sm:py-12">
        <div className="text-[10px] uppercase tracking-[0.22em] text-ink-muted flex items-center gap-2">
          <Leaf className="w-3 h-3" /> Colour directions
        </div>
        <h1 className="h-display text-4xl sm:text-6xl mt-2">A walk through nature.</h1>
        <p className="text-ink-muted mt-3 max-w-2xl text-sm sm:text-base leading-relaxed">
          Six complete directions drawn from the Australian landscape — forest greens, ocean
          blues, desert ochres, soft sand, and the pinks of native flowers. Each is shown
          applied to a snippet of the app so you can feel it. Tell me which one to run with and
          I&rsquo;ll take it across the whole app.
        </p>

        <div className="mt-10 sm:mt-12 grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-7">
          {PALETTES.map((p) => (
            <PaletteCard key={p.id} p={p} />
          ))}
        </div>

        <div className="mt-12 sm:mt-16 border-t border-line pt-8 text-center">
          <p className="text-xs text-ink-muted italic max-w-lg mx-auto">
            These are starting points — once you pick a direction I can fine-tune any tone,
            warm or cool it, or blend two together.
          </p>
        </div>
      </div>
    </main>
  )
}
