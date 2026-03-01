/*
  Warnings:

  - Added the required column `noOfGuests` to the `OfflineRoomBooking` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "OfflineRoomBooking" ADD COLUMN     "noOfGuests" INTEGER NOT NULL;
