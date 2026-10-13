ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "meetingReminders" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "meetingRemindersEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "reminderDayText" TEXT;
ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "reminder5hText" TEXT;
ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "reminder1hText" TEXT;
ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "noShowText" TEXT;
CREATE TABLE IF NOT EXISTS "TeamMember" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT,
  "phone" TEXT,
  "whatsappConversationId" TEXT,
  "notifyUrgent" BOOLEAN NOT NULL DEFAULT true,
  "notifyMeetings" BOOLEAN NOT NULL DEFAULT false,
  "notifyHandoffs" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TeamMember_pkey" PRIMARY KEY ("id")
);
