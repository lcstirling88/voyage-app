-- Manually-curated migration: add Trip.visaInfoJson — cached AI-generated
-- visa / entry requirements per destination country for the owner's passport.

ALTER TABLE "Trip" ADD COLUMN "visaInfoJson" TEXT;
