-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'booked';

-- Backfill: existing AI suggestions (flagged in metadata) become 'idea';
-- every real booking keeps the 'booked' default.
UPDATE "Booking" SET "status" = 'idea' WHERE "metadata" LIKE '%"__suggested":true%';
