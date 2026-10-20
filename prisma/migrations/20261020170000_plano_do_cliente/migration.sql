-- Plano do cliente: a Central LP grava os limites; o sistema só lê.
ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "planName" TEXT;
ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "planConversations" INTEGER;
ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "planMailboxes" INTEGER;
ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "planUsers" INTEGER;
ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "planAiBudgetUsd" DOUBLE PRECISION;
