-- CreateTable
CREATE TABLE "OfflineRoomBooking" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "guestName" TEXT NOT NULL,
    "checkIn" TIMESTAMP(3) NOT NULL,
    "checkOut" TIMESTAMP(3) NOT NULL,
    "rooms" INTEGER NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OfflineRoomBooking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OfflineRoomBooking_roomId_checkIn_checkOut_idx" ON "OfflineRoomBooking"("roomId", "checkIn", "checkOut");

-- CreateIndex
CREATE INDEX "OfflineRoomBooking_checkIn_checkOut_idx" ON "OfflineRoomBooking"("checkIn", "checkOut");

-- AddForeignKey
ALTER TABLE "OfflineRoomBooking" ADD CONSTRAINT "OfflineRoomBooking_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "HomestayRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
