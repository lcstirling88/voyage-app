'use client'

/**
 * "Off the beaten path" gallery on /inspiration — the same lesser-known
 * places that rotate one-per-day on the landing page, shown all at once.
 * Each card links to start a trip there. If an image fails to load, the card
 * keeps its warm gradient + caption rather than showing a broken image.
 */

import Link from 'next/link'
import { useState } from 'react'
import type { LandingPhoto } from '@/lib/landing-photos'

export function InspirationGalleryClient({ photos }: { photos: LandingPhoto[] }) {
  const [broken, setBroken] = useState<Set<string>>(new Set())

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
      {photos.map((p) => {
        const isBroken = broken.has(p.src)
        const destination = `${p.place}, ${p.country}`
        return (
          <Link
            key={p.src}
            href={`/trips/new?destination=${encodeURIComponent(destination)}`}
            className="group relative block rounded-xl overflow-hidden border border-line"
            style={{ background: 'linear-gradient(155deg, #C2853C 0%, #A8572F 55%, #6E3A28 100%)' }}
            aria-label={`Start a trip — ${destination}`}
          >
            <div className="relative h-44 sm:h-52">
              {!isBroken && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={p.src}
                  alt={`${p.place}, ${p.country} — ${p.blurb}`}
                  className="absolute inset-0 w-full h-full object-cover transition duration-500 group-hover:scale-105"
                  style={{ objectPosition: p.objectPosition ?? 'center' }}
                  onError={() => setBroken((s) => new Set(s).add(p.src))}
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
              <div className="absolute bottom-0 inset-x-0 p-4">
                <div className="text-[10px] uppercase tracking-[0.2em] text-white/85">
                  {p.place} · {p.country}
                </div>
                <p className="text-sm text-white mt-1 leading-snug drop-shadow">{p.blurb}</p>
              </div>
            </div>
          </Link>
        )
      })}
    </div>
  )
}
