'use client'

/**
 * Right-hand inspiration panel on the landing page: a daily photo with a
 * "what + where" caption. If the image fails to load, we hide it (and the
 * caption) and let the warm terracotta gradient show through — so a dud URL
 * degrades gracefully instead of flashing a broken-image icon or, worse,
 * pairing a caption with the wrong picture.
 */

import { useState } from 'react'
import type { LandingPhoto } from '@/lib/landing-photos'

export function LandingPhotoClient({ photo }: { photo: LandingPhoto }) {
  const [loaded, setLoaded] = useState(true)

  return (
    <aside
      className="relative overflow-hidden min-h-[42vh] md:min-h-screen"
      style={{
        background: 'linear-gradient(155deg, #C2853C 0%, #A8572F 52%, #6E3A28 100%)',
      }}
    >
      {loaded && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo.src}
            alt={`${photo.place}, ${photo.country} — ${photo.blurb}`}
            className="absolute inset-0 w-full h-full object-cover"
            style={{ objectPosition: photo.objectPosition ?? 'center' }}
            onError={() => setLoaded(false)}
          />
          <figcaption className="absolute inset-x-0 bottom-0 p-5 sm:p-7 bg-gradient-to-t from-black/65 via-black/30 to-transparent">
            <div className="text-white/85 text-[10px] uppercase tracking-[0.22em]">
              {photo.place} · {photo.country}
            </div>
            <p className="text-white text-sm sm:text-base mt-1.5 leading-snug max-w-md">
              {photo.blurb}
            </p>
          </figcaption>
        </>
      )}
    </aside>
  )
}
