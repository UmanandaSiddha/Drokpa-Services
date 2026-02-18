-- CreateIndex
CREATE INDEX "User_isDeleted_idx" ON "User"("isDeleted");

-- CreateIndex
CREATE INDEX "User_isDeleted_created_at_idx" ON "User"("isDeleted", "created_at");
