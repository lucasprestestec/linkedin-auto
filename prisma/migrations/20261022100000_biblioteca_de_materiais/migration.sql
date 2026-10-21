-- Biblioteca de materiais (arquivos e links que o corretor envia). Só cria tabela nova.
CREATE TABLE IF NOT EXISTS "Material" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "whenToUse" TEXT,
  "kind" TEXT NOT NULL,
  "url" TEXT,
  "fileName" TEXT,
  "mimeType" TEXT,
  "size" INTEGER NOT NULL DEFAULT 0,
  "data" BYTEA,
  "token" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "opens" INTEGER NOT NULL DEFAULT 0,
  "lastOpenAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Material_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Material_token_key" ON "Material"("token");
CREATE INDEX IF NOT EXISTS "Material_active_createdAt_idx" ON "Material"("active", "createdAt");

-- DESFAZER:
--   DROP TABLE "Material";
