-- CreateEnum
CREATE TYPE "BookingDateRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'BOOKING_CREATED', 'CANCELLED');

-- AlterTable
ALTER TABLE "Tour" ADD COLUMN     "bookingConditions" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "bookingRules" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "customDateMinParticipants" INTEGER,
ADD COLUMN     "customDateRequestEnabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "TourSuggestedTrek" (
    "id" TEXT NOT NULL,
    "tourId" TEXT NOT NULL,
    "trekId" TEXT NOT NULL,
    "rules" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "conditions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TourSuggestedTrek_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingDateRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tourId" TEXT NOT NULL,
    "status" "BookingDateRequestStatus" NOT NULL DEFAULT 'PENDING',
    "requestedStartDate" TIMESTAMP(3) NOT NULL,
    "requestedEndDate" TIMESTAMP(3),
    "approvedStartDate" TIMESTAMP(3),
    "approvedEndDate" TIMESTAMP(3),
    "participantsCount" INTEGER NOT NULL,
    "guests" JSONB NOT NULL,
    "addOnTrekIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "specialRequests" TEXT,
    "couponCode" TEXT,
    "requestedThreshold" INTEGER,
    "adminNote" TEXT,
    "rejectionReason" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdBookingId" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingDateRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TourSuggestedTrek_tourId_isActive_displayOrder_idx" ON "TourSuggestedTrek"("tourId", "isActive", "displayOrder");

-- CreateIndex
CREATE INDEX "TourSuggestedTrek_trekId_idx" ON "TourSuggestedTrek"("trekId");

-- CreateIndex
CREATE UNIQUE INDEX "TourSuggestedTrek_tourId_trekId_key" ON "TourSuggestedTrek"("tourId", "trekId");

-- CreateIndex
CREATE UNIQUE INDEX "BookingDateRequest_createdBookingId_key" ON "BookingDateRequest"("createdBookingId");

-- CreateIndex
CREATE INDEX "BookingDateRequest_userId_status_created_at_idx" ON "BookingDateRequest"("userId", "status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "BookingDateRequest_tourId_status_idx" ON "BookingDateRequest"("tourId", "status");

-- CreateIndex
CREATE INDEX "BookingDateRequest_reviewedBy_idx" ON "BookingDateRequest"("reviewedBy");

-- AddForeignKey
ALTER TABLE "TourSuggestedTrek" ADD CONSTRAINT "TourSuggestedTrek_tourId_fkey" FOREIGN KEY ("tourId") REFERENCES "Tour"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TourSuggestedTrek" ADD CONSTRAINT "TourSuggestedTrek_trekId_fkey" FOREIGN KEY ("trekId") REFERENCES "Tour"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingDateRequest" ADD CONSTRAINT "BookingDateRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingDateRequest" ADD CONSTRAINT "BookingDateRequest_tourId_fkey" FOREIGN KEY ("tourId") REFERENCES "Tour"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingDateRequest" ADD CONSTRAINT "BookingDateRequest_reviewedBy_fkey" FOREIGN KEY ("reviewedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingDateRequest" ADD CONSTRAINT "BookingDateRequest_createdBookingId_fkey" FOREIGN KEY ("createdBookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
