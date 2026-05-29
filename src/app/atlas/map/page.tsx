/**
 * Full-screen world map — opened from /atlas. Pure SVG over the entire
 * viewport, no chrome other than a floating close button. When the user
 * rotates their phone to landscape, the SVG (with its wider 2.33:1 crop
 * viewBox) scales to fill the viewport with negligible letterboxing.
 */

import Link from 'next/link'
import { X } from 'lucide-react'
import { requireUser } from '@/lib/session'
import { loadAtlasForUser, renderHintsFromCountries } from '@/lib/atlas'
import { WorldMapSvg } from '@/components/WorldMapSvg'

export default async function AtlasMapPage() {
  const user = await requireUser()
  const { countries, homeCountryIso } = await loadAtlasForUser(user.id)
  const renderHints = renderHintsFromCountries(countries, homeCountryIso)

  return (
    <div className="fixed inset-0 bg-paper-pure z-50 flex items-center justify-center overflow-hidden">
      <WorldMapSvg
        renderHints={renderHints}
        className="w-full h-full"
        ariaLabel="World map highlighting countries you have trips in"
      />
      <Link
        href="/atlas"
        aria-label="Close full-screen map"
        className="absolute top-[calc(env(safe-area-inset-top)+0.75rem)] right-3 sm:top-[calc(env(safe-area-inset-top)+1rem)] sm:right-4 bg-paper-pure/90 backdrop-blur p-2 rounded-md border border-line shadow-soft hover:bg-paper-pure text-ink-muted hover:text-ink transition"
      >
        <X className="w-5 h-5" />
      </Link>
    </div>
  )
}
