CREATE TABLE IF NOT EXISTS "CampaignStep" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "day" INTEGER NOT NULL,
  "channel" "MessageChannel",
  "text" TEXT NOT NULL,
  "notify" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "CampaignStep_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "CampaignStep_campaignId_position_key" ON "CampaignStep"("campaignId", "position");
DO $$ BEGIN
  ALTER TABLE "CampaignStep" ADD CONSTRAINT "CampaignStep_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
