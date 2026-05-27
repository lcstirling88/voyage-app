// Minimal types for d3-geo-projection. The package itself doesn't ship types
// and there's no @types/d3-geo-projection in DefinitelyTyped. We only need
// the few projections we might experiment with for the Atlas map.

declare module 'd3-geo-projection' {
  import type { GeoProjection } from 'd3-geo'
  export function geoWinkel3(): GeoProjection
  export function geoPatterson(): GeoProjection
  export function geoMiller(): GeoProjection
  export function geoRobinson(): GeoProjection
  export function geoMollweide(): GeoProjection
}
