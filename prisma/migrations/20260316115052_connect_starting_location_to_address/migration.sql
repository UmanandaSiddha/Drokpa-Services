-- AlterTable
ALTER TABLE "Tour" ADD COLUMN     "startingLocationAddressId" TEXT;

-- Backfill starting location relation from existing tour address for treks
UPDATE "Tour"
SET "startingLocationAddressId" = "addressId"
WHERE "type" = 'TREK'::"TourType"
	AND "startingLocationAddressId" IS NULL
	AND "addressId" IS NOT NULL;

-- CreateIndex
CREATE INDEX "Tour_startingLocationAddressId_idx" ON "Tour"("startingLocationAddressId");

-- AddForeignKey
ALTER TABLE "Tour" ADD CONSTRAINT "Tour_startingLocationAddressId_fkey" FOREIGN KEY ("startingLocationAddressId") REFERENCES "Address"("id") ON DELETE SET NULL ON UPDATE CASCADE;
