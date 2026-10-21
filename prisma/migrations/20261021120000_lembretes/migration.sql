-- Lembretes por pessoa (aparecem na tela Hoje quando vencem). Só acrescenta uma tabela; nada existente muda.
CREATE TABLE IF NOT EXISTS "LeadTask" (
  "id" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "dueAt" TIMESTAMP(3),
  "doneAt" TIMESTAMP(3),
  "source" TEXT NOT NULL DEFAULT 'MANUAL',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LeadTask_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LeadTask_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "LeadTask_doneAt_dueAt_idx" ON "LeadTask"("doneAt", "dueAt");
CREATE INDEX IF NOT EXISTS "LeadTask_leadId_idx" ON "LeadTask"("leadId");

-- DESFAZER: DROP TABLE "LeadTask";
