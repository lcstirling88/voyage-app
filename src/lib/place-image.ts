/**
 * Place imagery via Wikipedia/Wikimedia — free, no API key, no billing.
 *
 * Step 3 of planning ("Specific picks") shows a photo beside each suggested
 * attraction, because a name alone ("teamLab Planets") often doesn't tell you
 * what a thing is. We use the MediaWiki search-generator to find the best
 * matching article for a query and pull its lead thumbnail.
 *
 * Results are cached ~30 days per query (these are stable) and a descriptive
 * User-Agent is sent per Wikimedia's API etiquette. Returns null when nothing
 * suitable is found — the UI falls back to a themed gradient, so a missing
 * photo never breaks the layout.
 */

import { unstable_cache } from 'next/cache'

// Wikimedia asks API clients to identify themselves. A bare/generic UA can be
// rate-limited or blocked, so send a descriptive one (app + contact).
const WIKI_UA =
  'ItineraTravelApp/1.0 (https://voyage-christiansen.vercel.app; trip planner) anthropic-claude-agent'

async function fetchImageUncached(query: string): Promise<string | null> {
  const q = query.trim()
  if (!q) return null
  const url =
    'https://en.wikipedia.org/w/api.php' +
    '?action=query&format=json&origin=*&prop=pageimages&piprop=thumbnail&pithumbsize=800' +
    `&generator=search&gsrlimit=1&gsrnamespace=0&gsrsearch=${encodeURIComponent(q)}`
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': WIKI_UA, 'Api-User-Agent': WIKI_UA },
      next: { revalidate: 60 * 60 * 24 * 30 },
    })
    if (!res.ok) return null
    const data = await res.json()
    const pages = data?.query?.pages as
      | Record<string, { thumbnail?: { source?: string } }>
      | undefined
    if (!pages) return null
    for (const key of Object.keys(pages)) {
      const src = pages[key]?.thumbnail?.source
      if (typeof src === 'string' && src) return src
    }
    return null
  } catch {
    return null
  }
}

/**
 * Best lead photo for a place/attraction, or null. `context` (e.g. the city)
 * is appended to disambiguate generic names. Cached ~30 days per resolved
 * query, so repeat visits don't re-hit Wikipedia.
 */
export async function fetchPlaceImage(query: string, context?: string): Promise<string | null> {
  const q = [query, context].filter(Boolean).join(' ').trim()
  if (!q) return null
  const cached = unstable_cache(
    () => fetchImageUncached(q),
    ['place-image', q],
    { revalidate: 60 * 60 * 24 * 30 },
  )
  return cached()
}

/**
 * Map over items with bounded concurrency (default 6) so a city full of picks
 * doesn't fan out into dozens of simultaneous Wikipedia requests. Order of the
 * returned array matches the input.
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let cursor = 0
  async function worker() {
    while (cursor < items.length) {
      const i = cursor++
      results[i] = await fn(items[i], i)
    }
  }
  const n = Math.max(1, Math.min(limit, items.length))
  await Promise.all(Array.from({ length: n }, () => worker()))
  return results
}
