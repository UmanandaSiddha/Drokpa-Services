/*
  Warnings:

  - A unique constraint covering the columns `[slug]` on the table `Homestay` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[slug]` on the table `Tour` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `slug` to the `Homestay` table without a default value. This is not possible if the table is not empty.
  - Added the required column `slug` to the `Tour` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Homestay" ADD COLUMN     "slug" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Tour" ADD COLUMN     "slug" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Homestay_slug_key" ON "Homestay"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Tour_slug_key" ON "Tour"("slug");
