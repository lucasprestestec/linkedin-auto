-- Com quem a IA estava falando em cada chamada (tamanho de cada conversa e limite de uso justo).
ALTER TABLE "AiUsage" ADD COLUMN IF NOT EXISTS "leadId" TEXT;
CREATE INDEX IF NOT EXISTS "AiUsage_leadId_createdAt_idx" ON "AiUsage"("leadId", "createdAt");
