-- AlterTable
ALTER TABLE "Order"
ADD COLUMN     "transferredAt" TIMESTAMP(3),
ADD COLUMN     "transferredByUserId" TEXT,
ADD COLUMN     "transferredFromServiceCentreId" TEXT,
ADD COLUMN     "transferredToServiceCentreId" TEXT;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_transferredByUserId_fkey" FOREIGN KEY ("transferredByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_transferredFromServiceCentreId_fkey" FOREIGN KEY ("transferredFromServiceCentreId") REFERENCES "ServiceCentre"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_transferredToServiceCentreId_fkey" FOREIGN KEY ("transferredToServiceCentreId") REFERENCES "ServiceCentre"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "Order_transferredAt_idx" ON "Order"("transferredAt");

