-- Manually-curated migration: add VisitedCountry for user-added Atlas entries.

CREATE TABLE "VisitedCountry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isoNumeric" TEXT NOT NULL,
    "daysApprox" INTEGER,
    "yearVisited" INTEGER,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VisitedCountry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VisitedCountry_userId_isoNumeric_key" ON "VisitedCountry"("userId", "isoNumeric");
CREATE INDEX "VisitedCountry_userId_idx" ON "VisitedCountry"("userId");

ALTER TABLE "VisitedCountry"
  ADD CONSTRAINT "VisitedCountry_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
