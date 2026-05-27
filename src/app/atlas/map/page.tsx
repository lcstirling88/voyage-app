/**
 * Full-screen world map — opened from /atlas when the user wants to take in
 * the whole atlas at once, especially after rotating their phone to landscape.
 * No surrounding chrome (no sidebar, no hero); the map fills 100vw × 100vh
 * and rescales naturally when the device rotates.
 */

import Link from 'next/link'
import { X } from 'lucide-react'
import { requireUser } from '@/lib/session'
import { loadAtlasForUser, renderHintsFromCountries, LIVED_EDGE_COLOR } from '@/lib/atlas'
import { WorldMapSvg } from '@/components/WorldMapSvg'

export default async function AtlasMapPage() {
  const user = await requireUser()
  const { countries } = await loadAtlasForUser(user.id)
  const renderHints = renderHintsFromCountries(countries)

  return (
    <div className="fixed inset-0 bg-paper-pure flex flex-col z-50">
      {/* Slim top bar: title + close. */}
      <div className="flex items-center justify-between px-4 py-2 sm:py-3 border-b border-line bg-paper-pure">
        <div className="text-[10px] uppercase tracking-[0.22em] text-ink-muted">Atlas · World map</div>
        <Link
          href="/atlas"
          aria-label="Close full-screen map"
          className="text-ink-muted hover:text-ink p-1.5 -mr-1.5"
        >
          <X className="w-5 h-5" />
        </Link>
      </div>

      {/* Map fills remaining space. The SVG's preserveAspectRatio="xMidYMid meet"
          (set in WorldMapSvg) ensures the map scales to fit either portrait
          or landscape orientation when the phone rotates. */}
      <div className="flex-1 min-h-0 grid place-items-center p-1 sm:p-3">
        <WorldMapSvg
          renderHints={renderHints}
          className="w-full h-full max-w-full max-h-full"
          ariaLabel="World map highlighting countries you have trips in"
        />
      </div>

      {/* Compact legend at the bottom. Hides on very short viewports
          so the map gets all the room. */}
      {countries.length > 0 && (
        <div className="border-t border-line bg-paper-pure px-3 py-2 hidden landscape:flex sm:flex items-center justify-center gap-2 sm:gap-4 text-[8px] sm:text-[9px] uppercase tracking-[0.16em] text-ink-muted flex-wrap">
          <LegendChip color="#C8D4CC" label="★ Touchdown" />
          <LegendChip color="#7A9387" label="★★ Visited" />
          <LegendChip color="#3F5B4E" label="★★★ Explored" />
          <LegendChip color="#243730" label="★★★★ Lived" border={LIVED_EDGE_COLOR} />
          <LegendChip
            label="Going there"
            gradient="repeating-linear-gradient(45deg, #3F5B4E 0 3px, #A8B7AE 3px 6px)"
          />
        </div>
      )}
    </div>
  )
}

function LegendChip({
  color, gradient, label, border,
}: { color?: string; gradient?: string; label: string; border?: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span
        className="w-2.5 h-2.5 rounded-sm shrink-0"
        style={{
          background: gradient ?? color,
          ...(border ? { outline: `1.5px solid ${border}`, outlineOffset: '-1.5px' } : {}),
        }}
        aria-hidden
      />
      {label}
    </span>
  )
}
