ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "replyAnytime" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "assistantName" TEXT;
ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "assistantDiscloseAi" BOOLEAN NOT NULL DEFAULT false;
DO $$ BEGIN CREATE TYPE "KnowledgeMode" AS ENUM ('ALWAYS', 'ON_DEMAND', 'OFF'); EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE TABLE IF NOT EXISTS "KnowledgeSection" (
  "id" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "mode" "KnowledgeMode" NOT NULL DEFAULT 'ON_DEMAND',
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "KnowledgeSection_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "KnowledgeSection_position_idx" ON "KnowledgeSection"("position");
