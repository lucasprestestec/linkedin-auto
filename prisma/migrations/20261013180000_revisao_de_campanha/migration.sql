ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "campaignReview" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "campaignReviewDays" INTEGER NOT NULL DEFAULT 14;
ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "campaignReviewMessages" INTEGER NOT NULL DEFAULT 50;
ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "reviewReleasedAt" TIMESTAMP(3);
-- Campanhas que já existem não são "novas": ficam liberadas.
UPDATE "Campaign" SET "reviewReleasedAt" = now() WHERE "reviewReleasedAt" IS NULL AND "createdAt" < now() - interval '1 minute';
