// Minimal types for d3-geo-projection. The package itself doesn't ship types
// and there's no @types/d3-geo-projection in DefinitelyTyped. We only use
// geoWinkel3 (Winkel Tripel projection) so this is all that's needed.

declare module 'd3-geo-projection' {
  import type { GeoProjection } from 'd3-geo'
  export function geoWinkel3(): GeoProjection
}
