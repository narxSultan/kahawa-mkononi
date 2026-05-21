-- AlterEnum
ALTER TYPE "OrderStatus" ADD VALUE 'CUSTOMER_REJECTED';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "customerRejectedAt" TIMESTAMP(3),
ADD COLUMN     "customerRejectionReason" TEXT,
ADD COLUMN     "staffMessageAt" TIMESTAMP(3),
ADD COLUMN     "staffMessageByUserId" TEXT,
ADD COLUMN     "staffMessageText" TEXT,
ADD COLUMN     "staffResponseAt" TIMESTAMP(3),
ADD COLUMN     "staffResponseByUserId" TEXT,
ADD COLUMN     "staffResponseMessage" TEXT;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_staffResponseByUserId_fkey" FOREIGN KEY ("staffResponseByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_staffMessageByUserId_fkey" FOREIGN KEY ("staffMessageByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
