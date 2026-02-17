-- CreateEnum
CREATE TYPE "TourType" AS ENUM ('TOUR', 'TREK');

-- AlterTable
ALTER TABLE "BookingGuest" ADD COLUMN     "dateOfArrival" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Tour" ADD COLUMN     "guideId" TEXT,
ADD COLUMN     "type" "TourType" NOT NULL DEFAULT 'TOUR';

-- AddForeignKey
ALTER TABLE "Tour" ADD CONSTRAINT "Tour_guideId_fkey" FOREIGN KEY ("guideId") REFERENCES "LocalGuide"("id") ON DELETE SET NULL ON UPDATE CASCADE;
