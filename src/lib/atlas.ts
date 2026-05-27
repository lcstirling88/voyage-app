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
  /** Total nights/days across all trips to this country. */
  totalDays: number
  /** Number of trips to this country. */
  tripCount: number
  /** True if at least one trip has already ended (today > endDate). */
  hasCompleted: boolean
  /** True if at least one trip is still upcoming (today < startDate or in-progress). */
  hasUpcoming: boolean
  /** Trip rows for the card body. */
  trips: { slug: string; name: string; startDate: Date; endDate: Date; days: number }[]
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
