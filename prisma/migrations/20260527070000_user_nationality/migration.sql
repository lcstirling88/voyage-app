-- Manually-curated migration: add User.nationalityIso (passport country).
-- Drives per-destination visa / entry requirements. Nullable; falls back to
-- homeCountryIso in app code when unset.

ALTER TABLE "User" ADD COLUMN "nationalityIso" TEXT;
