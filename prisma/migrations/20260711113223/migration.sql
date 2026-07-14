/*
  Warnings:

  - You are about to drop the column `assignedToId` on the `Ticket` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Ticket" DROP CONSTRAINT "Ticket_assignedToId_fkey";

-- DropIndex
DROP INDEX "Ticket_assignedToId_idx";

-- AlterTable
ALTER TABLE "Ticket" DROP COLUMN "assignedToId",
ADD COLUMN     "closedById" INTEGER,
ADD COLUMN     "currentAssignedToId" INTEGER,
ADD COLUMN     "currentForwardedById" INTEGER,
ADD COLUMN     "currentReassignedById" INTEGER,
ADD COLUMN     "currentRevertedById" INTEGER,
ADD COLUMN     "routingStatus" TEXT NOT NULL DEFAULT 'NONE';

-- CreateTable
CREATE TABLE "TicketAssignee" (
    "ticketId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "forwardedFrom" TEXT,
    "revertedFrom" TEXT,
    "reassignedFrom" TEXT,

    CONSTRAINT "TicketAssignee_pkey" PRIMARY KEY ("ticketId","userId")
);

-- CreateIndex
CREATE INDEX "TicketAssignee_ticketId_idx" ON "TicketAssignee"("ticketId");

-- CreateIndex
CREATE INDEX "TicketAssignee_userId_idx" ON "TicketAssignee"("userId");

-- CreateIndex
CREATE INDEX "Ticket_currentAssignedToId_idx" ON "Ticket"("currentAssignedToId");

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_currentAssignedToId_fkey" FOREIGN KEY ("currentAssignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_currentForwardedById_fkey" FOREIGN KEY ("currentForwardedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_currentReassignedById_fkey" FOREIGN KEY ("currentReassignedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_currentRevertedById_fkey" FOREIGN KEY ("currentRevertedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketAssignee" ADD CONSTRAINT "TicketAssignee_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketAssignee" ADD CONSTRAINT "TicketAssignee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
