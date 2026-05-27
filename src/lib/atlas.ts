/**
 * Server-only helpers for the Atlas page: project the world-atlas TopoJSON
 * into SVG path strings keyed by ISO 3166-1 numeric country code, plus a
 * small types module describing the per-country aggregate shape the Atlas
 * page passes down to the renderer.
 *
 * We use the 110m resolution dataset (~108 KB JSON) — fine for a static
 * overview map; if we ever need detail (clickable city dots, region zoom)
 * we'd swap to countries-50m.json.
 */

import { geoNaturalEarth1, geoPath } from 'd3-geo'
import { feature } from 'topojson-client'
import type { GeometryCollection, Topology } from 'topojson-specification'
import worldAtlas from 'world-atlas/countries-110m.json'
import type { FeatureCollection, Geometry } from 'geojson'

export type AtlasCountrySummary = {
  /** ISO 3166-1 numeric code as string (matches the TopoJSON id). */
  isoNumeric: string
  /** Friendly label used in the card. */
  label: string
  /** Cute emoji shown on the country card. */
  passportIcon: string | null
  /** Total nights/days across all trips to this country (completed + upcoming). */
  totalDays: number
  /** Days from trips that have already ended — the basis for the tier rank. */
  completedDays: number
  /** Number of trips to this country. */
  tripCount: number
  /** True if at least one trip has already ended (today > endDate). */
  hasCompleted: boolean
  /** True if at least one trip is still upcoming (today < startDate or in-progress). */
  hasUpcoming: boolean
  /** Trip rows for the card body. */
  trips: { slug: string; name: string; startDate: Date; endDate: Date; days: number; completed: boolean }[]
}

// ---------------------------------------------------------------------------
// Tier ranking — rewards depth of visit. Only completed trips count toward
// tier (upcoming trips paint the country but don't yet earn the badge).

export type AtlasTier = 'touchdown' | 'visited' | 'explored' | 'lived'

export type AtlasTierSpec = {
  tier: AtlasTier
  label: string
  stars: number       // 1-4, shown on the card
  mapFill: string     // base sage fill on the world map
  isLived: boolean    // gates the gold edge + crown stamp
}

const TIERS: Record<AtlasTier, AtlasTierSpec> = {
  touchdown: { tier: 'touchdown', label: 'Touchdown', stars: 1, mapFill: '#C8D4CC', isLived: false },
  visited:   { tier: 'visited',   label: 'Visited',   stars: 2, mapFill: '#7A9387', isLived: false },
  explored:  { tier: 'explored',  label: 'Explored',  stars: 3, mapFill: '#3F5B4E', isLived: false },
  lived:     { tier: 'lived',     label: 'Lived',     stars: 4, mapFill: '#243730', isLived: true },
}

export function tierForDays(days: number): AtlasTierSpec {
  if (days >= 31) return TIERS.lived
  if (days >= 15) return TIERS.explored
  if (days >= 4) return TIERS.visited
  return TIERS.touchdown
}

/** Fill used for a country whose only trips are still upcoming (hatched pattern). */
export const UPCOMING_ONLY_FILL = 'url(#hatch-upcoming)'
/** Fill used for countries the user has no trips in. */
export const UNVISITED_FILL = '#E8E2D4'
/** Gold border colour for the Lived tier — matches --color-gold in globals.css. */
export const LIVED_EDGE_COLOR = '#A8814B'

// ---------------------------------------------------------------------------
// Trip aggregation — shared by /atlas and /atlas/map so the same trips
// produce the same map highlights on both routes.

import { differenceInDays, startOfDay } from 'date-fns'
import { prisma } from './db'
import { profileForDestination, profileForIsoNumeric } from './destinations'

export type AtlasManualVisit = {
  id: string
  daysApprox: number | null
  yearVisited: number | null
  note: string | null
}

export async function loadAtlasForUser(userId: string): Promise<{
  countries: AtlasCountrySummary[]
  totalDays: number
  totalTrips: number
  manualByIso: Map<string, AtlasManualVisit>
}> {
  const [memberships, visited] = await Promise.all([
    prisma.membership.findMany({
      where: { userId },
      include: { trip: true },
      orderBy: { trip: { startDate: 'asc' } },
    }),
    prisma.visitedCountry.findMany({ where: { userId } }),
  ])
  const trips = memberships.map((m) => m.trip)

  const today = startOfDay(new Date())
  const byCountry = new Map<string, AtlasCountrySummary>()
  const manualByIso = new Map<string, AtlasManualVisit>()

  for (const trip of trips) {
    const profile = profileForDestination(trip.destination)
    if (!profile.isoNumeric) continue
    const days = Math.max(1, differenceInDays(startOfDay(trip.endDate), startOfDay(trip.startDate)) + 1)
    const completed = startOfDay(trip.endDate) < today
    const existing = byCountry.get(profile.isoNumeric)
    if (existing) {
      existing.totalDays += days
      if (completed) existing.completedDays += days
      existing.tripCount += 1
      if (completed) existing.hasCompleted = true
      else existing.hasUpcoming = true
      existing.trips.push({
        slug: trip.slug, name: trip.name,
        startDate: trip.startDate, endDate: trip.endDate, days, completed,
      })
    } else {
      byCountry.set(profile.isoNumeric, {
        isoNumeric: profile.isoNumeric,
        label: profile.label,
        passportIcon: profile.passportIcon ?? null,
        totalDays: days,
        completedDays: completed ? days : 0,
        tripCount: 1,
        hasCompleted: completed,
        hasUpcoming: !completed,
        trips: [{
          slug: trip.slug, name: trip.name,
          startDate: trip.startDate, endDate: trip.endDate, days, completed,
        }],
      })
    }
  }

  // Merge in manually-added visits. Each one counts as 1 trip + its declared
  // days (1 if unspecified). Manual visits are always completed (they're "I've
  // been there", not "I'm planning to go").
  for (const v of visited) {
    manualByIso.set(v.isoNumeric, {
      id: v.id,
      daysApprox: v.daysApprox,
      yearVisited: v.yearVisited,
      note: v.note,
    })
    const profile = profileForIsoNumeric(v.isoNumeric)
    const label = profile?.label ?? v.isoNumeric
    const passportIcon = profile?.passportIcon ?? null
    const days = Math.max(1, v.daysApprox ?? 1)
    const existing = byCountry.get(v.isoNumeric)
    if (existing) {
      existing.totalDays += days
      existing.completedDays += days
      existing.tripCount += 1
      existing.hasCompleted = true
    } else {
      byCountry.set(v.isoNumeric, {
        isoNumeric: v.isoNumeric,
        label,
        passportIcon,
        totalDays: days,
        completedDays: days,
        tripCount: 1,
        hasCompleted: true,
        hasUpcoming: false,
        trips: [],
      })
    }
  }

  const countries = [...byCountry.values()].sort((a, b) => {
    if (a.hasCompleted !== b.hasCompleted) return a.hasCompleted ? -1 : 1
    if (a.completedDays !== b.completedDays) return b.completedDays - a.completedDays
    return b.totalDays - a.totalDays
  })

  return {
    countries,
    totalDays: countries.reduce((s, c) => s + c.totalDays, 0),
    totalTrips: trips.length,
    manualByIso,
  }
}

/** Build the renderHints Map the WorldMapSvg component expects. */
export function renderHintsFromCountries(
  countries: AtlasCountrySummary[],
): Map<string, { tier: AtlasTierSpec | null; upcomingOnly: boolean }> {
  const hints = new Map<string, { tier: AtlasTierSpec | null; upcomingOnly: boolean }>()
  for (const c of countries) {
    hints.set(c.isoNumeric, {
      tier: c.completedDays > 0 ? tierForDays(c.completedDays) : null,
      upcomingOnly: c.completedDays === 0 && c.hasUpcoming,
    })
  }
  return hints
}

/** Map's intrinsic projection viewbox dimensions. Used by both the SVG and the page layout. */
export const ATLAS_VIEW_WIDTH = 980
export const ATLAS_VIEW_HEIGHT = 480

const projection = geoNaturalEarth1()
  .scale(ATLAS_VIEW_WIDTH / 6.2)
  .translate([ATLAS_VIEW_WIDTH / 2, ATLAS_VIEW_HEIGHT / 2])
const pathGen = geoPath(projection)

type CountryProps = { name?: string }
type CountryFeature = GeoJSON.Feature<Geometry, CountryProps> & { id?: string | number }

/**
 * Pre-projected SVG path strings for every country in the world-atlas dataset,
 * keyed by ISO numeric code. Computed once at module load; cheap to re-use.
 */
export const COUNTRY_PATHS: Array<{ id: string; d: string; name: string }> = (() => {
  // The TopoJSON type from world-atlas isn't strictly typed, so cast through unknown.
  const topology = worldAtlas as unknown as Topology<{ countries: GeometryCollection }>
  const collection = feature(topology, topology.objects.countries) as unknown as FeatureCollection<Geometry, CountryProps>
  const out: Array<{ id: string; d: string; name: string }> = []
  for (const f of collection.features) {
    const cf = f as CountryFeature
    const d = pathGen(f) ?? ''
    if (!d) continue
    out.push({
      id: String(cf.id ?? ''),
      d,
      name: cf.properties?.name ?? '',
    })
  }
  return out
})()
