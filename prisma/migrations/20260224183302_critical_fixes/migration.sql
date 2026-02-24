-- Fix 1: RoomAvailability DateTime to Date
-- Prevents timezone drift issues with room bookings
ALTER TABLE "RoomAvailability" 
ALTER COLUMN "date" SET DATA TYPE date USING ("date"::date);

-- Fix 2: Add partial unique indexes for Review (handles NULL values correctly)
-- Ensures one review per user per tour
CREATE UNIQUE INDEX IF NOT EXISTS "uq_review_user_tour" 
ON "Review"("userId", "tourId") 
WHERE "tourId" IS NOT NULL AND "homestayId" IS NULL;

-- Ensures one review per user per homestay  
CREATE UNIQUE INDEX IF NOT EXISTS "uq_review_user_homestay" 
ON "Review"("userId", "homestayId") 
WHERE "homestayId" IS NOT NULL AND "tourId" IS NULL;

-- Fix 3: Add missing performance indexes
-- Booking queries (user dashboard, provider views)
CREATE INDEX IF NOT EXISTS "idx_booking_user_status_created" 
ON "Booking"("userId", "status", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "idx_booking_status_expires" 
ON "Booking"("status", "expiresAt") 
WHERE "status" = 'AWAITING_PAYMENT';

-- Payment verification
CREATE INDEX IF NOT EXISTS "idx_payment_booking_status" 
ON "Payment"("bookingId", "status");

-- Review filtering and sorting
CREATE INDEX IF NOT EXISTS "idx_review_tour_rating" 
ON "Review"("tourId", "rating" DESC);

CREATE INDEX IF NOT EXISTS "idx_review_homestay_rating" 
ON "Review"("homestayId", "rating" DESC);

-- Room availability (CRITICAL for booking engine)
CREATE INDEX IF NOT EXISTS "idx_room_availability_room_date" 
ON "RoomAvailability"("roomId", "date" DESC);

-- Homestay queries
CREATE INDEX IF NOT EXISTS "idx_homestay_provider_active" 
ON "Homestay"("providerId", "isActive");

-- User queries
CREATE INDEX IF NOT EXISTS "idx_user_email_verified" 
ON "User"("email", "isVerified");

-- Booking item lookups
CREATE INDEX IF NOT EXISTS "idx_booking_item_product" 
ON "BookingItem"("productType", "productId");

-- Document tracking
CREATE INDEX IF NOT EXISTS "idx_document_user_type" 
ON "Document"("userId", "type", "deletedAt");

-- TemporaryUpload lifecycle
CREATE INDEX IF NOT EXISTS "idx_temp_upload_expiry_used" 
ON "TemporaryUpload"("expiresAt", "isUsed", "deletedAt");

-- Permit status tracking
CREATE INDEX IF NOT EXISTS "idx_permit_status_updated" 
ON "Permit"("status", "updated_at" DESC);

-- Payout status
CREATE INDEX IF NOT EXISTS "idx_payout_provider_status" 
ON "ProviderPayout"("providerId", "status", "created_at" DESC);

-- Session management  
CREATE INDEX IF NOT EXISTS "idx_session_user_expires" 
ON "Session"("userId", "expiresAt");
