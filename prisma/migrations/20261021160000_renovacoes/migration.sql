-- Renovações da carteira: data de vencimento e descrição do contrato em cada pessoa. Só acrescenta colunas.
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "renewalAt" TIMESTAMP(3);
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "renewalNote" TEXT;
CREATE INDEX IF NOT EXISTS "Lead_renewalAt_idx" ON "Lead"("renewalAt");

-- DESFAZER:
--   DROP INDEX "Lead_renewalAt_idx";
--   ALTER TABLE "Lead" DROP COLUMN "renewalAt", DROP COLUMN "renewalNote";
