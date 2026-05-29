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

// Patterson Cylindrical — a modern projection (Patterson, Šavrič, Jenny, 2014)
// designed specifically to give a flat, rectangular "wall-map" silhouette
// (straight east-west, gently tapered north-south) without Mercator's brutal
// polar distortion. Reads as a flat printed atlas page, no globe-warping.
import { geoPath } from 'd3-geo'
import { geoPatterson } from 'd3-geo-projection'
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

// ---------------------------------------------------------------------------
// Countries-visited tier — separate from the per-country day tier above.
// Rewards BREADTH (distinct countries) instead of DEPTH (days per country).
// Shown as a small medallion badge on the profile's Countries Visited card.

export type CountryBreadthTier =
  | 'wanderer' | 'traveller' | 'explorer'
  | 'adventurer' | 'globetrotter' | 'worldCitizen'

export type CountryBreadthSpec = {
  tier: CountryBreadthTier
  label: string
  /** Lucide icon key — resolved in the badge component to the actual icon. */
  icon: 'pin' | 'plane' | 'compass' | 'map' | 'globe' | 'crown'
  /** Pretty range label shown under the medallion. */
  rangeLabel: string
  /** Medallion background colour. */
  color: string
  /** Icon colour on top of the medallion. */
  iconColor: string
}

const COUNTRY_BREADTH_TIERS: CountryBreadthSpec[] = [
  { tier: 'wanderer',     label: 'Wanderer',      icon: 'pin',     rangeLabel: 'Start the journey', color: '#E8E2D4', iconColor: '#5C4938' },
  { tier: 'traveller',    label: 'Traveller',     icon: 'plane',   rangeLabel: '1–10 countries',    color: '#A8B7AE', iconColor: '#FBF8F1' },
  { tier: 'explorer',     label: 'Explorer',      icon: 'compass', rangeLabel: '11–25 countries',   color: '#7A9387', iconColor: '#FBF8F1' },
  { tier: 'adventurer',   label: 'Adventurer',    icon: 'map',     rangeLabel: '26–50 countries',   color: '#3F5B4E', iconColor: '#FBF8F1' },
  { tier: 'globetrotter', label: 'Globetrotter',  icon: 'globe',   rangeLabel: '51–99 countries',   color: '#A8814B', iconColor: '#FBF8F1' },
  { tier: 'worldCitizen', label: 'World Citizen', icon: 'crown',   rangeLabel: '100+ countries',    color: '#6B2737', iconColor: '#FBF8F1' },
]

export function tierForCountryCount(count: number): CountryBreadthSpec {
  if (count >= 100) return COUNTRY_BREADTH_TIERS[5]
  if (count >= 51)  return COUNTRY_BREADTH_TIERS[4]
  if (count >= 26)  return COUNTRY_BREADTH_TIERS[3]
  if (count >= 11)  return COUNTRY_BREADTH_TIERS[2]
  if (count >= 1)   return COUNTRY_BREADTH_TIERS[1]
  return COUNTRY_BREADTH_TIERS[0]
}

/** Fill used for a country whose only trips are still upcoming (hatched pattern). */
export const UPCOMING_ONLY_FILL = 'url(#hatch-upcoming)'
/** Fill used for countries the user has no trips in. Two shades darker than
 *  the original very-pale beige so unvisited land reads clearly as land
 *  (not as ocean) and the visited sage tiers pop a little harder. */
export const UNVISITED_FILL = '#B8B0A0'
/** Gold border colour for the Lived tier — matches --color-gold in globals.css. */
export const LIVED_EDGE_COLOR = '#A8814B'
/** Deep wine burgundy used for the user's country of residence. Sits at the
 *  same visual weight as the Lived tier (#243730) but warm where that's
 *  cool, so "home" reads as a distinct category rather than another tier on
 *  the travel ladder. Paired with the gold Lived edge for prominence. */
export const HOME_FILL = '#6B2737'

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
  /** Travel destinations only — the user's home country is split out below. */
  countries: AtlasCountrySummary[]
  /** Where the user lives, if set. Carries any trip data for that ISO too
   *  (domestic trips don't paint a tier on the map — home stays burgundy —
   *  but the trip list still appears on the home card). */
  homeCountry: AtlasCountrySummary | null
  /** ISO 3166-1 numeric of the home country, or null. */
  homeCountryIso: string | null
  /** ISO 3166-1 numeric of the user's passport, or null (falls back to home). */
  nationalityIso: string | null
  /** Days summed across `countries` only (excludes home). */
  totalDays: number
  /** All memberships, including domestic trips. */
  totalTrips: number
  manualByIso: Map<string, AtlasManualVisit>
}> {
  const [user, memberships, visited] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { homeCountryIso: true, nationalityIso: true } }),
    prisma.membership.findMany({
      where: { userId },
      include: { trip: true },
      orderBy: { trip: { startDate: 'asc' } },
    }),
    prisma.visitedCountry.findMany({ where: { userId } }),
  ])
  const homeIso = user?.homeCountryIso ?? null
  const nationalityIso = user?.nationalityIso ?? null
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

  // Pull the home country out of the regular destinations list. If the user
  // has trips to/within their home country those aggregations still exist —
  // we just attach them to `homeCountry` rather than letting them appear as
  // a travel destination on the map and in stats.
  let homeCountry: AtlasCountrySummary | null = null
  if (homeIso) {
    const fromAgg = byCountry.get(homeIso)
    if (fromAgg) {
      homeCountry = fromAgg
      byCountry.delete(homeIso)
    } else {
      const profile = profileForIsoNumeric(homeIso)
      homeCountry = {
        isoNumeric: homeIso,
        label: profile?.label ?? homeIso,
        passportIcon: profile?.passportIcon ?? null,
        totalDays: 0,
        completedDays: 0,
        tripCount: 0,
        hasCompleted: false,
        hasUpcoming: false,
        trips: [],
      }
    }
  }

  const countries = [...byCountry.values()].sort((a, b) => {
    if (a.hasCompleted !== b.hasCompleted) return a.hasCompleted ? -1 : 1
    if (a.completedDays !== b.completedDays) return b.completedDays - a.completedDays
    return b.totalDays - a.totalDays
  })

  return {
    countries,
    homeCountry,
    homeCountryIso: homeIso,
    nationalityIso,
    totalDays: countries.reduce((s, c) => s + c.totalDays, 0),
    totalTrips: trips.length,
    manualByIso,
  }
}

export type AtlasRenderHint = {
  tier: AtlasTierSpec | null
  upcomingOnly: boolean
  /** True for the user's country of residence — paints burgundy regardless
   *  of any trip aggregations on that ISO. */
  home: boolean
}

/** Build the renderHints Map the WorldMapSvg component expects. Pass the
 *  user's `homeCountryIso` to paint that country in burgundy with a gold
 *  edge — overrides any tier that would otherwise be assigned. */
export function renderHintsFromCountries(
  countries: AtlasCountrySummary[],
  homeCountryIso?: string | null,
): Map<string, AtlasRenderHint> {
  const hints = new Map<string, AtlasRenderHint>()
  for (const c of countries) {
    hints.set(c.isoNumeric, {
      tier: c.completedDays > 0 ? tierForDays(c.completedDays) : null,
      upcomingOnly: c.completedDays === 0 && c.hasUpcoming,
      home: false,
    })
  }
  // Home wins over any tier — even if the user has trips there, the
  // country reads as "home" on the map, not as a travel destination.
  if (homeCountryIso) {
    hints.set(homeCountryIso, { tier: null, upcomingOnly: false, home: true })
  }
  return hints
}

/** Map's intrinsic projection viewbox dimensions. Used by both the SVG and the page layout. */
export const ATLAS_VIEW_WIDTH = 980
export const ATLAS_VIEW_HEIGHT = 480

type CountryProps = { name?: string }
type CountryFeature = GeoJSON.Feature<Geometry, CountryProps> & { id?: string | number }

/**
 * Pre-projected SVG path strings for every country in the world-atlas dataset,
 * keyed by ISO numeric code. Computed once at module load; cheap to re-use.
 *
 * Uses projection.fitExtent so the world is auto-fitted to the viewBox with
 * a small inset margin — no risk of polar regions getting clipped by a
 * hand-tuned scale being too large.
 */
export const COUNTRY_PATHS: Array<{ id: string; d: string; name: string }> = (() => {
  const topology = worldAtlas as unknown as Topology<{ countries: GeometryCollection }>
  const collection = feature(topology, topology.objects.countries) as unknown as FeatureCollection<Geometry, CountryProps>

  const projection = geoPatterson()
  projection.fitExtent(
    [[8, 8], [ATLAS_VIEW_WIDTH - 8, ATLAS_VIEW_HEIGHT - 8]],
    collection,
  )
  const pathGen = geoPath(projection)

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
