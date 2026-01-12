/*
  Warnings:

  - You are about to drop the `UserIdentity` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "UserIdentity" DROP CONSTRAINT "UserIdentity_userId_fkey";

-- DropTable
DROP TABLE "UserIdentity";

-- DropEnum
DROP TYPE "IdentityProvider";

-- DropEnum
DROP TYPE "IdentityStatus";
