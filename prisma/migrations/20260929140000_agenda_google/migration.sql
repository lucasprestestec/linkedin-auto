-- Troca o link de agenda pelo Google Agenda.
ALTER TABLE "Lead" RENAME COLUMN "bookingLinkSentAt" TO "slotsProposedAt";
ALTER TABLE "Lead" ADD COLUMN "googleEventId" TEXT,
ADD COLUMN "meetingLink" TEXT;

ALTER TABLE "Settings" DROP COLUMN "bookingUrl",
ADD COLUMN "googleCalendarEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "meetingMinutes" INTEGER NOT NULL DEFAULT 30;

ALTER TABLE "Draft" ADD COLUMN "booking" JSONB;
