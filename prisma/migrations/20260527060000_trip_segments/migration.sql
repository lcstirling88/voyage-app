-- Manually-curated migration: add TripSegment for multi-country trips.
-- A trip with no segments falls back to a single implicit leg derived from
-- Trip.destination, so existing trips need no backfill.

CREATE TABLE "TripSegment" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "isoNumeric" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TripSegment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TripSegment_tripId_idx" ON "TripSegment"("tripId");

ALTER TABLE "TripSegment"
  ADD CONSTRAINT "TripSegment_tripId_fkey"
  FOREIGN KEY ("tripId") REFERENCES "Trip"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
