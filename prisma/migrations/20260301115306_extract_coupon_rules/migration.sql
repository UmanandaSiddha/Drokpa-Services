-- AlterTable
ALTER TABLE "Coupon" ADD COLUMN     "applicableProductIds" TEXT[],
ADD COLUMN     "applicableProductTypes" TEXT[],
ADD COLUMN     "firstTimeOnly" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "minParticipants" INTEGER;
