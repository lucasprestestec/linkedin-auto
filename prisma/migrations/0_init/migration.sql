-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'INVITE_SENT', 'WAITING_REPLY', 'CONVERSATION_OPEN', 'NEEDS_HUMAN', 'QUALIFIED', 'LOST');

-- CreateEnum
CREATE TYPE "MessageChannel" AS ENUM ('LINKEDIN', 'EMAIL', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "MessageSender" AS ENUM ('LEAD', 'AGENT', 'HUMAN');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('ACTIVE', 'PAUSED', 'FINISHED');

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "linkedinProfileUrl" TEXT,
    "linkedinProfileId" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "jobTitle" TEXT,
    "status" "LeadStatus" NOT NULL DEFAULT 'INVITE_SENT',
    "linkedinThreadId" TEXT,
    "linkedinConnected" BOOLEAN NOT NULL DEFAULT false,
    "firstContactChannel" "MessageChannel",
    "connectedAt" TIMESTAMP(3),
    "whatsappConversationId" TEXT,
    "whatsappLastAt" TIMESTAMP(3),
    "needsHumanReason" TEXT,
    "invitedAt" TIMESTAMP(3),
    "followUpsSent" INTEGER NOT NULL DEFAULT 0,
    "followUpMaxCount" INTEGER,
    "followUpDelayHours" INTEGER,
    "email" TEXT,
    "phone" TEXT,
    "personal" TEXT,
    "notes" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "icpScore" INTEGER,
    "campaignId" TEXT,
    "archivedAt" TIMESTAMP(3),
    "nextStep" TEXT,
    "nextStepAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "audience" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "instructions" TEXT,
    "maxLeads" INTEGER,
    "followUpMaxCount" INTEGER,
    "followUpDelayHours" INTEGER,
    "status" "CampaignStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebSearchLog" (
    "id" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "page" INTEGER NOT NULL DEFAULT 0,
    "results" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebSearchLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "sender" "MessageSender" NOT NULL,
    "channel" "MessageChannel" NOT NULL DEFAULT 'LINKEDIN',
    "content" TEXT NOT NULL,
    "linkedinMessageId" TEXT,
    "emailMessageId" TEXT,
    "subject" TEXT,
    "emailThreadId" TEXT,
    "whatsappMessageId" TEXT,
    "openToken" TEXT,
    "openCount" INTEGER NOT NULL DEFAULT 0,
    "firstOpenedAt" TIMESTAMP(3),
    "lastOpenedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Settings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "automationPaused" BOOLEAN NOT NULL DEFAULT true,
    "ownerName" TEXT,
    "dailyInviteLimit" INTEGER NOT NULL DEFAULT 18,
    "dailyMessageLimit" INTEGER NOT NULL DEFAULT 25,
    "linkedinIdentityId" TEXT,
    "linkedinLoginLink" TEXT,
    "linkedinLoginLinkAt" TIMESTAMP(3),
    "agentInstructions" TEXT,
    "agentModel" TEXT,
    "targetAudience" TEXT,
    "followUpMaxCount" INTEGER NOT NULL DEFAULT 2,
    "followUpDelayHours" INTEGER NOT NULL DEFAULT 48,
    "connectionsCheckedAt" TIMESTAMP(3),
    "workStartHour" INTEGER NOT NULL DEFAULT 8,
    "workEndHour" INTEGER NOT NULL DEFAULT 19,
    "workWeekdaysOnly" BOOLEAN NOT NULL DEFAULT true,
    "exclusionList" TEXT,
    "acceptInvitesEnabled" BOOLEAN NOT NULL DEFAULT false,
    "withdrawInvitesEnabled" BOOLEAN NOT NULL DEFAULT false,
    "withdrawAfterDays" INTEGER NOT NULL DEFAULT 21,
    "warmupEnabled" BOOLEAN NOT NULL DEFAULT false,
    "archiveLostEnabled" BOOLEAN NOT NULL DEFAULT false,
    "receivedInvitesCheckedAt" TIMESTAMP(3),
    "withdrawCheckedAt" TIMESTAMP(3),
    "emailChannelEnabled" BOOLEAN NOT NULL DEFAULT true,
    "deskcommUrl" TEXT,
    "deskcommToken" TEXT,
    "deskcommChannelId" TEXT,
    "whatsappChannelEnabled" BOOLEAN NOT NULL DEFAULT true,
    "dailyWhatsappLimit" INTEGER NOT NULL DEFAULT 15,
    "dailySummaryEnabled" BOOLEAN NOT NULL DEFAULT true,
    "dailySummarySentOn" TEXT,
    "dailyEmailLimit" INTEGER NOT NULL DEFAULT 20,
    "emailInviteFallbackDays" INTEGER DEFAULT 5,
    "googleEmail" TEXT,
    "googleRefreshToken" TEXT,
    "googleHistoryId" TEXT,
    "emailLastUid" INTEGER,
    "emailUidValidity" TEXT,
    "linkedinNeedsReconnect" BOOLEAN NOT NULL DEFAULT false,
    "linkedinReconnectReason" TEXT,

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Lead_linkedinProfileUrl_key" ON "Lead"("linkedinProfileUrl");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_linkedinThreadId_key" ON "Lead"("linkedinThreadId");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_whatsappConversationId_key" ON "Lead"("whatsappConversationId");

-- CreateIndex
CREATE INDEX "WebSearchLog_createdAt_idx" ON "WebSearchLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- CreateIndex
CREATE UNIQUE INDEX "Message_linkedinMessageId_key" ON "Message"("linkedinMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "Message_emailMessageId_key" ON "Message"("emailMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "Message_whatsappMessageId_key" ON "Message"("whatsappMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "Message_openToken_key" ON "Message"("openToken");

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

