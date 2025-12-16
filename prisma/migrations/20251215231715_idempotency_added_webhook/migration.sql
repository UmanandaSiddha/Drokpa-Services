/*
  Warnings:

  - A unique constraint covering the columns `[providerEventId]` on the table `WebhookEvent` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `provider` to the `WebhookEvent` table without a default value. This is not possible if the table is not empty.
  - Added the required column `providerEventId` to the `WebhookEvent` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "customerId" TEXT;

-- AlterTable
ALTER TABLE "WebhookEvent" ADD COLUMN     "provider" "PaymentProvider" NOT NULL,
ADD COLUMN     "providerEventId" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_providerEventId_key" ON "WebhookEvent"("providerEventId");
