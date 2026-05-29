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
    <aside className="relative flex min-h-[44dvh] md:min-h-dvh p-5 sm:p-7 md:p-8">
      {/* Framed, softly-arched photo floating on the page wash — a window
          onto the place, rather than a full-bleed rectangle with hard edges. */}
      <div
        className="relative flex-1 overflow-hidden rounded-t-[5rem] rounded-b-[2rem] shadow-lift ring-1 ring-black/10"
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
            <figcaption className="absolute inset-x-0 bottom-0 p-5 sm:p-6 bg-gradient-to-t from-black/70 via-black/30 to-transparent">
              <div className="text-white/85 text-[10px] uppercase tracking-[0.22em]">
                {photo.place} · {photo.country}
              </div>
              <p className="text-white text-sm mt-1.5 leading-snug">
                {photo.blurb}
              </p>
            </figcaption>
          </>
        )}
      </div>
    </aside>
  )
}
