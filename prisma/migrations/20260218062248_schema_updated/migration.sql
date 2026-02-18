/*
  Warnings:

  - You are about to drop the column `imageUrl` on the `AppBanner` table. All the data in the column will be lost.
  - You are about to drop the column `productId` on the `BucketListItem` table. All the data in the column will be lost.
  - You are about to drop the column `targetId` on the `Review` table. All the data in the column will be lost.
  - You are about to drop the `Destinations` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[productId,productType]` on the table `CancellationPolicy` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[tourId,dayNumber]` on the table `TourItinerary` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `bookingItemId` to the `ProviderPayout` table without a default value. This is not possible if the table is not empty.
  - Added the required column `netAmount` to the `ProviderPayout` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "BucketListItem" DROP CONSTRAINT "BucketListItem_homestay_fkey";

-- DropForeignKey
ALTER TABLE "BucketListItem" DROP CONSTRAINT "BucketListItem_tour_fkey";

-- DropForeignKey
ALTER TABLE "Review" DROP CONSTRAINT "Review_homestay_fkey";

-- DropForeignKey
ALTER TABLE "Review" DROP CONSTRAINT "Review_tour_fkey";

-- DropIndex
DROP INDEX "BucketListItem_productId_idx";

-- DropIndex
DROP INDEX "BucketListItem_productType_productId_idx";

-- DropIndex
DROP INDEX "CancellationPolicy_productType_productId_key";

-- DropIndex
DROP INDEX "Review_targetType_targetId_idx";

-- DropIndex
DROP INDEX "Review_userId_targetType_targetId_key";

-- AlterTable
ALTER TABLE "AppBanner" DROP COLUMN "imageUrl",
ADD COLUMN     "imageUrls" TEXT[];

-- AlterTable
ALTER TABLE "BucketListItem" DROP COLUMN "productId",
ADD COLUMN     "homestayId" TEXT,
ADD COLUMN     "tourId" TEXT;

-- AlterTable
ALTER TABLE "ProviderPayout" ADD COLUMN     "bookingItemId" TEXT NOT NULL,
ADD COLUMN     "netAmount" INTEGER NOT NULL,
ADD COLUMN     "platformFee" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Review" DROP COLUMN "targetId",
ADD COLUMN     "homestayId" TEXT,
ADD COLUMN     "tourId" TEXT;

-- AlterTable
ALTER TABLE "RoomAvailability" ALTER COLUMN "date" SET DATA TYPE DATE;

-- DropTable
DROP TABLE "Destinations";

-- CreateTable
CREATE TABLE "Destination" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "imageUrls" TEXT[],
    "tripPrice" INTEGER NOT NULL,
    "noOfDays" INTEGER[],
    "tags" TEXT[],
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "address" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Destination_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BucketListItem_tourId_idx" ON "BucketListItem"("tourId");

-- CreateIndex
CREATE INDEX "BucketListItem_homestayId_idx" ON "BucketListItem"("homestayId");

-- CreateIndex
CREATE INDEX "BucketListItem_bucketListId_idx" ON "BucketListItem"("bucketListId");

-- CreateIndex
CREATE UNIQUE INDEX "CancellationPolicy_productId_productType_key" ON "CancellationPolicy"("productId", "productType");

-- CreateIndex
CREATE INDEX "ProviderPayout_providerId_status_idx" ON "ProviderPayout"("providerId", "status");

-- CreateIndex
CREATE INDEX "ProviderPayout_bookingItemId_idx" ON "ProviderPayout"("bookingItemId");

-- CreateIndex
CREATE INDEX "Review_tourId_idx" ON "Review"("tourId");

-- CreateIndex
CREATE INDEX "Review_homestayId_idx" ON "Review"("homestayId");

-- CreateIndex
CREATE INDEX "Review_userId_idx" ON "Review"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TourItinerary_tourId_dayNumber_key" ON "TourItinerary"("tourId", "dayNumber");

-- AddForeignKey
ALTER TABLE "BucketListItem" ADD CONSTRAINT "BucketListItem_tourId_fkey" FOREIGN KEY ("tourId") REFERENCES "Tour"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BucketListItem" ADD CONSTRAINT "BucketListItem_homestayId_fkey" FOREIGN KEY ("homestayId") REFERENCES "Homestay"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Onboarding" ADD CONSTRAINT "Onboarding_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_tourId_fkey" FOREIGN KEY ("tourId") REFERENCES "Tour"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_homestayId_fkey" FOREIGN KEY ("homestayId") REFERENCES "Homestay"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderPayout" ADD CONSTRAINT "ProviderPayout_bookingItemId_fkey" FOREIGN KEY ("bookingItemId") REFERENCES "BookingItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
