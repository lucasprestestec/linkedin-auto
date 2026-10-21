-- Formulário público de captação por campanha e origem/consentimento do contato. Só acrescenta colunas.
ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "captureOn" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "captureSlug" TEXT;
ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "captureTitle" TEXT;
ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "captureText" TEXT;
ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "captureChannel" "MessageChannel";
CREATE UNIQUE INDEX IF NOT EXISTS "Campaign_captureSlug_key" ON "Campaign"("captureSlug");
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "source" TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "consentAt" TIMESTAMP(3);

-- DESFAZER:
--   ALTER TABLE "Campaign" DROP COLUMN "captureOn", DROP COLUMN "captureSlug", DROP COLUMN "captureTitle", DROP COLUMN "captureText", DROP COLUMN "captureChannel";
--   ALTER TABLE "Lead" DROP COLUMN "source", DROP COLUMN "consentAt";
