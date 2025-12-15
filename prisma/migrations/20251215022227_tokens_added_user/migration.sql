-- AlterTable
ALTER TABLE "User" ADD COLUMN     "oneTimeExpire" TIMESTAMP(3),
ADD COLUMN     "oneTimePassword" TEXT,
ADD COLUMN     "resetToken" TEXT,
ADD COLUMN     "resetTokenExpire" TIMESTAMP(3);
