-- CreateEnum
CREATE TYPE "DraftKind" AS ENUM ('REPLY', 'OPENING', 'FIRST_CONTACT', 'INTRO_EMAIL', 'FOLLOW_UP');

-- CreateEnum
CREATE TYPE "DraftStatus" AS ENUM ('PENDING', 'APPROVED', 'SENT', 'DISCARDED', 'EXPIRED', 'FAILED');

-- AlterTable
ALTER TABLE "Settings" ADD COLUMN     "approvalMode" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "Draft" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "kind" "DraftKind" NOT NULL,
    "channel" "MessageChannel" NOT NULL,
    "subject" TEXT,
    "content" TEXT NOT NULL,
    "reason" TEXT,
    "effects" JSONB NOT NULL,
    "status" "DraftStatus" NOT NULL DEFAULT 'PENDING',
    "edited" BOOLEAN NOT NULL DEFAULT false,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "Draft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Draft_status_createdAt_idx" ON "Draft"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Draft_leadId_status_idx" ON "Draft"("leadId", "status");

-- AddForeignKey
ALTER TABLE "Draft" ADD CONSTRAINT "Draft_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

