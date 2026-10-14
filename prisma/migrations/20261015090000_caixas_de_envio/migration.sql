DO $$ BEGIN
  CREATE TYPE "MailboxStatus" AS ENUM ('ACTIVE', 'PAUSED', 'RETIRED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "Mailbox" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "address" TEXT NOT NULL,
  "displayName" TEXT,
  "status" "MailboxStatus" NOT NULL DEFAULT 'ACTIVE',
  "smtpHost" TEXT NOT NULL,
  "smtpPort" INTEGER NOT NULL,
  "smtpSecure" BOOLEAN NOT NULL,
  "imapHost" TEXT NOT NULL,
  "imapPort" INTEGER NOT NULL,
  "imapSecure" BOOLEAN NOT NULL,
  "passwordEnc" TEXT NOT NULL,
  "dailyLimit" INTEGER NOT NULL DEFAULT 25,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "imapLastUid" INTEGER,
  "imapUidValidity" TEXT,
  "bounces" INTEGER NOT NULL DEFAULT 0,
  "lastCheckedAt" TIMESTAMP(3),
  "lastError" TEXT,
  "lastErrorAt" TIMESTAMP(3),
  CONSTRAINT "Mailbox_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Mailbox_address_key" ON "Mailbox"("address");

ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "mailboxId" TEXT;
DO $$ BEGIN
  ALTER TABLE "Message" ADD CONSTRAINT "Message_mailboxId_fkey" FOREIGN KEY ("mailboxId") REFERENCES "Mailbox"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "emailBouncedAt" TIMESTAMP(3);
