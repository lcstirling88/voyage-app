-- Manually-curated migration: add User.homeCountryIso for "where I live".
-- ISO 3166-1 numeric code as a string (matches the destinations registry
-- + the world-atlas TopoJSON id). Nullable — users opt in.

ALTER TABLE "User" ADD COLUMN "homeCountryIso" TEXT;
