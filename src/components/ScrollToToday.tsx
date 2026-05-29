'use client'

/**
 * On an in-progress trip, gently scroll the day-by-day view to today's block on
 * load — so an active traveller opens the itinerary already on "now". Respects
 * an explicit anchor: if the URL carries a #day-… hash (e.g. tapped from the
 * calendar strip), that deep-link wins and we don't fight it.
 */

import { useEffect } from 'react'

export function ScrollToToday({ targetId }: { targetId: string }) {
  useEffect(() => {
    if (window.location.hash) return
    const el = document.getElementById(targetId)
    if (!el) return
    // Defer a frame so layout (hero image, calendar strip) has settled.
    const t = window.setTimeout(() => {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 100)
    return () => window.clearTimeout(t)
  }, [targetId])

  return null
}
