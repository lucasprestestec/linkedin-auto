-- AlterEnum
ALTER TYPE "LeadStatus" ADD VALUE 'MEETING_SCHEDULED';

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "bookingLinkSentAt" TIMESTAMP(3),
ADD COLUMN     "bookingNudgedAt" TIMESTAMP(3),
ADD COLUMN     "meetingAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Settings" ADD COLUMN     "bookingUrl" TEXT;

