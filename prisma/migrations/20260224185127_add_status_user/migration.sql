-- DropIndex
DROP INDEX "Booking_userId_status_idx";

-- DropIndex
DROP INDEX "idx_document_user_type";

-- DropIndex
DROP INDEX "idx_homestay_provider_active";

-- DropIndex
DROP INDEX "Payment_bookingId_idx";

-- DropIndex
DROP INDEX "Permit_status_idx";

-- DropIndex
DROP INDEX "ProviderPayout_providerId_status_idx";

-- DropIndex
DROP INDEX "Review_homestayId_idx";

-- DropIndex
DROP INDEX "Review_tourId_idx";

-- DropIndex
DROP INDEX "RoomAvailability_date_idx";

-- DropIndex
DROP INDEX "Session_userId_idx";

-- DropIndex
DROP INDEX "idx_temp_upload_expiry_used";

-- DropIndex
DROP INDEX "User_email_idx";

-- AlterTable
ALTER TABLE "RoomAvailability" ADD COLUMN     "price" INTEGER;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "status" TEXT;

-- RenameIndex
ALTER INDEX "idx_booking_user_status_created" RENAME TO "Booking_userId_status_created_at_idx";

-- RenameIndex
ALTER INDEX "idx_payment_booking_status" RENAME TO "Payment_bookingId_status_idx";

-- RenameIndex
ALTER INDEX "idx_permit_status_updated" RENAME TO "Permit_status_updated_at_idx";

-- RenameIndex
ALTER INDEX "idx_payout_provider_status" RENAME TO "ProviderPayout_providerId_status_created_at_idx";

-- RenameIndex
ALTER INDEX "idx_review_homestay_rating" RENAME TO "Review_homestayId_rating_idx";

-- RenameIndex
ALTER INDEX "idx_review_tour_rating" RENAME TO "Review_tourId_rating_idx";

-- RenameIndex
ALTER INDEX "idx_room_availability_room_date" RENAME TO "RoomAvailability_roomId_date_idx";

-- RenameIndex
ALTER INDEX "idx_session_user_expires" RENAME TO "Session_userId_expiresAt_idx";

-- RenameIndex
ALTER INDEX "idx_user_email_verified" RENAME TO "User_email_isVerified_idx";
