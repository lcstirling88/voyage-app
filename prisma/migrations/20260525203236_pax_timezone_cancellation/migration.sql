-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "cancelByAt" TIMESTAMP(3),
ADD COLUMN     "cancellationPolicy" TEXT;

-- AlterTable
ALTER TABLE "Trip" ADD COLUMN     "adultCount" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "childCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "childrenAges" TEXT,
ADD COLUMN     "localCurrency" TEXT,
ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'UTC';

-- CreateIndex
CREATE INDEX "Booking_cancelByAt_idx" ON "Booking"("cancelByAt");
