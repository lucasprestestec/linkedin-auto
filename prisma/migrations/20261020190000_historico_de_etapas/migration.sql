-- Histórico de etapas: registra QUANDO cada mudança aconteceu (oportunidade, reunião marcada, resultado do negócio).
-- Só acrescenta; nada existente é alterado. Para desfazer: ver o fim deste arquivo.

DO $$ BEGIN
  CREATE TYPE "DealStage" AS ENUM ('HELD', 'NO_SHOW', 'PROPOSAL', 'WON', 'LOST');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "dealStage" "DealStage";
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "dealValueCents" INTEGER;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "dealReason" TEXT;
ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "syncReport" JSONB;

CREATE TABLE IF NOT EXISTS "LeadStageEvent" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "leadId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "fromValue" TEXT,
  "toValue" TEXT,
  "meetingAt" TIMESTAMP(3),
  "amountCents" INTEGER,
  "backfill" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LeadStageEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LeadStageEvent_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "LeadStageEvent_kind_toValue_createdAt_idx" ON "LeadStageEvent"("kind", "toValue", "createdAt");
CREATE INDEX IF NOT EXISTS "LeadStageEvent_leadId_idx" ON "LeadStageEvent"("leadId");

-- Histórico anterior: a data real não existe, então usa a última alteração da ficha e marca como estimada.
INSERT INTO "LeadStageEvent" ("leadId", "kind", "toValue", "backfill", "createdAt")
SELECT "id", 'STATUS', "status"::text, true, "updatedAt" FROM "Lead"
WHERE "status" IN ('QUALIFIED', 'MEETING_SCHEDULED')
  AND NOT EXISTS (SELECT 1 FROM "LeadStageEvent" e WHERE e."leadId" = "Lead"."id");
INSERT INTO "LeadStageEvent" ("leadId", "kind", "meetingAt", "backfill", "createdAt")
SELECT "id", 'MEETING', "meetingAt", true, "updatedAt" FROM "Lead"
WHERE "meetingAt" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "LeadStageEvent" e WHERE e."leadId" = "Lead"."id" AND e."kind" = 'MEETING');

-- Gatilho: qualquer caminho que mude status, reunião ou resultado do negócio deixa o registro.
CREATE OR REPLACE FUNCTION lead_stage_log() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO "LeadStageEvent" ("leadId", "kind", "toValue") VALUES (NEW."id", 'STATUS', NEW."status"::text);
    IF NEW."meetingAt" IS NOT NULL THEN
      INSERT INTO "LeadStageEvent" ("leadId", "kind", "meetingAt") VALUES (NEW."id", 'MEETING', NEW."meetingAt");
    END IF;
    RETURN NULL;
  END IF;
  IF NEW."status" IS DISTINCT FROM OLD."status" THEN
    INSERT INTO "LeadStageEvent" ("leadId", "kind", "fromValue", "toValue")
    VALUES (NEW."id", 'STATUS', OLD."status"::text, NEW."status"::text);
  END IF;
  IF NEW."meetingAt" IS NOT NULL AND NEW."meetingAt" IS DISTINCT FROM OLD."meetingAt" THEN
    INSERT INTO "LeadStageEvent" ("leadId", "kind", "meetingAt") VALUES (NEW."id", 'MEETING', NEW."meetingAt");
  END IF;
  IF NEW."dealStage" IS DISTINCT FROM OLD."dealStage" OR NEW."dealValueCents" IS DISTINCT FROM OLD."dealValueCents" THEN
    INSERT INTO "LeadStageEvent" ("leadId", "kind", "fromValue", "toValue", "amountCents")
    VALUES (NEW."id", 'DEAL', OLD."dealStage"::text, NEW."dealStage"::text, NEW."dealValueCents");
  END IF;
  RETURN NULL;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS lead_stage_log_trg ON "Lead";
CREATE TRIGGER lead_stage_log_trg
AFTER INSERT OR UPDATE OF "status", "meetingAt", "dealStage", "dealValueCents" ON "Lead"
FOR EACH ROW EXECUTE FUNCTION lead_stage_log();

-- DESFAZER (se precisar):
--   DROP TRIGGER lead_stage_log_trg ON "Lead"; DROP FUNCTION lead_stage_log();
--   DROP TABLE "LeadStageEvent"; ALTER TABLE "Lead" DROP COLUMN "dealStage", DROP COLUMN "dealValueCents", DROP COLUMN "dealReason";
--   ALTER TABLE "Settings" DROP COLUMN "syncReport"; DROP TYPE "DealStage";
