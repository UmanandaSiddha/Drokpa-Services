/*
  Warnings:

  - You are about to drop the column `price` on the `BookingItem` table. All the data in the column will be lost.
  - You are about to drop the column `facilities` on the `Homestay` table. All the data in the column will be lost.
  - You are about to drop the column `tags` on the `Homestay` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `Refund` table. All the data in the column will be lost.
  - You are about to alter the column `rating` on the `Review` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `SmallInt`.
  - You are about to drop the column `price` on the `Tour` table. All the data in the column will be lost.
  - You are about to drop the column `tags` on the `Tour` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[latitude,longitude]` on the table `Address` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[providerOrderId]` on the table `Payment` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[providerPaymentId]` on the table `Payment` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[providerRefundId]` on the table `Refund` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[refreshToken]` on the table `Session` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `basePrice` to the `BookingItem` table without a default value. This is not possible if the table is not empty.
  - Added the required column `discount` to the `BookingItem` table without a default value. This is not possible if the table is not empty.
  - Added the required column `finalPrice` to the `BookingItem` table without a default value. This is not possible if the table is not empty.
  - Added the required column `totalAmount` to the `BookingItem` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `productType` on the `BookingItem` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `productType` on the `BucketListItem` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `productType` on the `CancellationPolicy` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `serviceType` on the `FeatureFlag` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Added the required column `finalPrice` to the `HomestayRoom` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `targetType` on the `Review` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Added the required column `basePrice` to the `Tour` table without a default value. This is not possible if the table is not empty.
  - Added the required column `finalPrice` to the `Tour` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "BookingCriteria" AS ENUM ('PER_PERSON', 'PER_NIGHT', 'HYBRID');

-- AlterEnum
ALTER TYPE "ProviderType" ADD VALUE 'ILP_VENDOR';

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "cancellationReason" TEXT,
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "confirmedAt" TIMESTAMP(3),
ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "paidAmount" INTEGER,
ADD COLUMN     "totalAmount" INTEGER;

-- AlterTable
ALTER TABLE "BookingGuest" ADD COLUMN     "email" TEXT;

-- AlterTable
ALTER TABLE "BookingItem" DROP COLUMN "price",
ADD COLUMN     "basePrice" INTEGER NOT NULL,
ADD COLUMN     "discount" INTEGER NOT NULL,
ADD COLUMN     "finalPrice" INTEGER NOT NULL,
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "totalAmount" INTEGER NOT NULL,
DROP COLUMN "productType",
ADD COLUMN     "productType" "ProviderType" NOT NULL;

-- AlterTable
ALTER TABLE "BucketListItem" DROP COLUMN "productType",
ADD COLUMN     "productType" "ProviderType" NOT NULL;

-- AlterTable
ALTER TABLE "CancellationPolicy" DROP COLUMN "productType",
ADD COLUMN     "productType" "ProviderType" NOT NULL;

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "s3Bucket" TEXT,
ADD COLUMN     "s3Key" TEXT,
ADD COLUMN     "tempUploadId" TEXT;

-- AlterTable
ALTER TABLE "FeatureFlag" DROP COLUMN "serviceType",
ADD COLUMN     "serviceType" "ProviderType" NOT NULL;

-- AlterTable
ALTER TABLE "Homestay" DROP COLUMN "facilities",
DROP COLUMN "tags",
ADD COLUMN     "bookingCriteria" "BookingCriteria" NOT NULL DEFAULT 'PER_NIGHT',
ADD COLUMN     "displayPrice" INTEGER,
ADD COLUMN     "houseRules" TEXT[],
ADD COLUMN     "rating" DOUBLE PRECISION DEFAULT 0,
ADD COLUMN     "safetyNSecurity" TEXT[],
ADD COLUMN     "totalReviews" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "HomestayRoom" ADD COLUMN     "amenities" TEXT[],
ADD COLUMN     "bookingCriteria" "BookingCriteria" NOT NULL DEFAULT 'PER_NIGHT',
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "discount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "finalPrice" INTEGER NOT NULL,
ADD COLUMN     "imageUrls" TEXT[],
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "capturedAt" TIMESTAMP(3),
ADD COLUMN     "failedAt" TIMESTAMP(3),
ADD COLUMN     "failureReason" TEXT;

-- AlterTable
ALTER TABLE "Refund" DROP COLUMN "createdAt",
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "failedAt" TIMESTAMP(3),
ADD COLUMN     "failureReason" TEXT,
ADD COLUMN     "processedAt" TIMESTAMP(3),
ADD COLUMN     "providerRefundId" TEXT,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Review" ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
DROP COLUMN "targetType",
ADD COLUMN     "targetType" "ProviderType" NOT NULL,
ALTER COLUMN "rating" SET DATA TYPE SMALLINT;

-- AlterTable
ALTER TABLE "Tour" DROP COLUMN "price",
DROP COLUMN "tags",
ADD COLUMN     "basePrice" INTEGER NOT NULL,
ADD COLUMN     "discount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "finalPrice" INTEGER NOT NULL,
ADD COLUMN     "providerId" TEXT,
ADD COLUMN     "rating" DOUBLE PRECISION DEFAULT 0,
ADD COLUMN     "totalReviews" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isDisabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isOnline" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastSeen" TIMESTAMP(3),
ADD COLUMN     "notificationPreferences" JSONB,
ADD COLUMN     "timezone" TEXT;

-- DropEnum
DROP TYPE "ProductType";

-- DropEnum
DROP TYPE "ReviewTarget";

-- DropEnum
DROP TYPE "ServiceType";

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "icon" TEXT,
    "category" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TourTag" (
    "tourId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "TourTag_pkey" PRIMARY KEY ("tourId","tagId")
);

-- CreateTable
CREATE TABLE "HomestayTag" (
    "homestayId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "HomestayTag_pkey" PRIMARY KEY ("homestayId","tagId")
);

-- CreateTable
CREATE TABLE "Facility" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Facility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HomestayFacility" (
    "homestayId" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,

    CONSTRAINT "HomestayFacility_pkey" PRIMARY KEY ("homestayId","facilityId")
);

-- CreateTable
CREATE TABLE "RoomBooking" (
    "id" TEXT NOT NULL,
    "bookingItemId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "checkIn" TIMESTAMP(3) NOT NULL,
    "checkOut" TIMESTAMP(3) NOT NULL,
    "guests" INTEGER NOT NULL,
    "specialRequests" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoomBooking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemporaryUpload" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "sessionId" TEXT,
    "s3Key" TEXT NOT NULL,
    "s3Bucket" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "associatedWith" TEXT,
    "referenceId" TEXT,
    "isUsed" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TemporaryUpload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceWaitlist" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "phoneNumber" TEXT,
    "serviceType" "ProviderType" NOT NULL,
    "location" TEXT,
    "notified" BOOLEAN NOT NULL DEFAULT false,
    "notifiedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceWaitlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunityJoinRequest" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "location" TEXT,
    "interests" TEXT[],
    "message" TEXT,
    "contacted" BOOLEAN NOT NULL DEFAULT false,
    "contactedAt" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunityJoinRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tag_label_key" ON "Tag"("label");

-- CreateIndex
CREATE UNIQUE INDEX "Facility_name_key" ON "Facility"("name");

-- CreateIndex
CREATE UNIQUE INDEX "RoomBooking_bookingItemId_key" ON "RoomBooking"("bookingItemId");

-- CreateIndex
CREATE INDEX "RoomBooking_roomId_checkIn_checkOut_idx" ON "RoomBooking"("roomId", "checkIn", "checkOut");

-- CreateIndex
CREATE INDEX "RoomBooking_checkIn_checkOut_idx" ON "RoomBooking"("checkIn", "checkOut");

-- CreateIndex
CREATE UNIQUE INDEX "TemporaryUpload_s3Key_key" ON "TemporaryUpload"("s3Key");

-- CreateIndex
CREATE INDEX "TemporaryUpload_expiresAt_deletedAt_idx" ON "TemporaryUpload"("expiresAt", "deletedAt");

-- CreateIndex
CREATE INDEX "TemporaryUpload_userId_associatedWith_idx" ON "TemporaryUpload"("userId", "associatedWith");

-- CreateIndex
CREATE INDEX "TemporaryUpload_sessionId_expiresAt_idx" ON "TemporaryUpload"("sessionId", "expiresAt");

-- CreateIndex
CREATE INDEX "TemporaryUpload_isUsed_expiresAt_idx" ON "TemporaryUpload"("isUsed", "expiresAt");

-- CreateIndex
CREATE INDEX "ServiceWaitlist_serviceType_notified_idx" ON "ServiceWaitlist"("serviceType", "notified");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceWaitlist_email_serviceType_key" ON "ServiceWaitlist"("email", "serviceType");

-- CreateIndex
CREATE UNIQUE INDEX "CommunityJoinRequest_email_key" ON "CommunityJoinRequest"("email");

-- CreateIndex
CREATE INDEX "CommunityJoinRequest_contacted_idx" ON "CommunityJoinRequest"("contacted");

-- CreateIndex
CREATE INDEX "CommunityJoinRequest_created_at_idx" ON "CommunityJoinRequest"("created_at");

-- CreateIndex
CREATE INDEX "Activity_providerId_idx" ON "Activity"("providerId");

-- CreateIndex
CREATE UNIQUE INDEX "Address_latitude_longitude_key" ON "Address"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "Booking_userId_status_idx" ON "Booking"("userId", "status");

-- CreateIndex
CREATE INDEX "Booking_status_expiresAt_idx" ON "Booking"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "Booking_created_at_idx" ON "Booking"("created_at");

-- CreateIndex
CREATE INDEX "BookingGuest_bookingItemId_idx" ON "BookingGuest"("bookingItemId");

-- CreateIndex
CREATE INDEX "BookingItem_bookingId_idx" ON "BookingItem"("bookingId");

-- CreateIndex
CREATE INDEX "BookingItem_productType_productId_idx" ON "BookingItem"("productType", "productId");

-- CreateIndex
CREATE INDEX "BucketListItem_productId_idx" ON "BucketListItem"("productId");

-- CreateIndex
CREATE INDEX "BucketListItem_productType_productId_idx" ON "BucketListItem"("productType", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "CancellationPolicy_productType_productId_key" ON "CancellationPolicy"("productType", "productId");

-- CreateIndex
CREATE INDEX "Document_s3Key_idx" ON "Document"("s3Key");

-- CreateIndex
CREATE INDEX "Document_tempUploadId_idx" ON "Document"("tempUploadId");

-- CreateIndex
CREATE UNIQUE INDEX "FeatureFlag_serviceType_key" ON "FeatureFlag"("serviceType");

-- CreateIndex
CREATE INDEX "FeatureFlag_serviceType_enabled_idx" ON "FeatureFlag"("serviceType", "enabled");

-- CreateIndex
CREATE INDEX "Homestay_providerId_idx" ON "Homestay"("providerId");

-- CreateIndex
CREATE INDEX "Homestay_addressId_idx" ON "Homestay"("addressId");

-- CreateIndex
CREATE INDEX "Homestay_isActive_rating_idx" ON "Homestay"("isActive", "rating");

-- CreateIndex
CREATE INDEX "HomestayRoom_homestayId_isActive_idx" ON "HomestayRoom"("homestayId", "isActive");

-- CreateIndex
CREATE INDEX "LocalGuide_providerId_idx" ON "LocalGuide"("providerId");

-- CreateIndex
CREATE INDEX "LocalGuide_addressId_idx" ON "LocalGuide"("addressId");

-- CreateIndex
CREATE INDEX "Onboarding_token_expiresAt_idx" ON "Onboarding"("token", "expiresAt");

-- CreateIndex
CREATE INDEX "POI_addressId_idx" ON "POI"("addressId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_providerOrderId_key" ON "Payment"("providerOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_providerPaymentId_key" ON "Payment"("providerPaymentId");

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

-- CreateIndex
CREATE INDEX "Payment_providerOrderId_idx" ON "Payment"("providerOrderId");

-- CreateIndex
CREATE INDEX "Permit_participantId_idx" ON "Permit"("participantId");

-- CreateIndex
CREATE INDEX "Provider_status_verified_idx" ON "Provider"("status", "verified");

-- CreateIndex
CREATE UNIQUE INDEX "Refund_providerRefundId_key" ON "Refund"("providerRefundId");

-- CreateIndex
CREATE INDEX "Refund_paymentId_idx" ON "Refund"("paymentId");

-- CreateIndex
CREATE INDEX "Refund_status_idx" ON "Refund"("status");

-- CreateIndex
CREATE INDEX "Review_targetType_targetId_idx" ON "Review"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "Review_rating_idx" ON "Review"("rating");

-- CreateIndex
CREATE UNIQUE INDEX "Review_userId_targetType_targetId_key" ON "Review"("userId", "targetType", "targetId");

-- CreateIndex
CREATE INDEX "RoomAvailability_date_idx" ON "RoomAvailability"("date");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_refreshToken_key" ON "Session"("refreshToken");

-- CreateIndex
CREATE INDEX "Tour_providerId_idx" ON "Tour"("providerId");

-- CreateIndex
CREATE INDEX "Tour_isActive_rating_idx" ON "Tour"("isActive", "rating");

-- CreateIndex
CREATE INDEX "Tour_addressId_idx" ON "Tour"("addressId");

-- CreateIndex
CREATE INDEX "TourItinerary_tourId_idx" ON "TourItinerary"("tourId");

-- CreateIndex
CREATE INDEX "TourItineraryPOI_itineraryId_idx" ON "TourItineraryPOI"("itineraryId");

-- CreateIndex
CREATE INDEX "TourItineraryPOI_poiId_idx" ON "TourItineraryPOI"("poiId");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_isDisabled_isVerified_idx" ON "User"("isDisabled", "isVerified");

-- CreateIndex
CREATE INDEX "Vehicle_providerId_idx" ON "Vehicle"("providerId");

-- CreateIndex
CREATE INDEX "Vehicle_addressId_idx" ON "Vehicle"("addressId");

-- AddForeignKey
ALTER TABLE "BucketListItem" ADD CONSTRAINT "BucketListItem_tour_fkey" FOREIGN KEY ("productId") REFERENCES "Tour"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BucketListItem" ADD CONSTRAINT "BucketListItem_homestay_fkey" FOREIGN KEY ("productId") REFERENCES "Homestay"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_tour_fkey" FOREIGN KEY ("targetId") REFERENCES "Tour"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_homestay_fkey" FOREIGN KEY ("targetId") REFERENCES "Homestay"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TourTag" ADD CONSTRAINT "TourTag_tourId_fkey" FOREIGN KEY ("tourId") REFERENCES "Tour"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TourTag" ADD CONSTRAINT "TourTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomestayTag" ADD CONSTRAINT "HomestayTag_homestayId_fkey" FOREIGN KEY ("homestayId") REFERENCES "Homestay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomestayTag" ADD CONSTRAINT "HomestayTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomestayFacility" ADD CONSTRAINT "HomestayFacility_homestayId_fkey" FOREIGN KEY ("homestayId") REFERENCES "Homestay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomestayFacility" ADD CONSTRAINT "HomestayFacility_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tour" ADD CONSTRAINT "Tour_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomBooking" ADD CONSTRAINT "RoomBooking_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "HomestayRoom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomBooking" ADD CONSTRAINT "RoomBooking_bookingItemId_fkey" FOREIGN KEY ("bookingItemId") REFERENCES "BookingItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
