-- Conta os envios que o servidor de destino bloqueou (reputação, spam, autenticação), separado do endereço inexistente.
-- Só acrescenta duas colunas; nada existente muda.
ALTER TABLE "Mailbox" ADD COLUMN IF NOT EXISTS "blockedBounces" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Mailbox" ADD COLUMN IF NOT EXISTS "lastBlockedAt" TIMESTAMP(3);

-- DESFAZER: ALTER TABLE "Mailbox" DROP COLUMN "blockedBounces", DROP COLUMN "lastBlockedAt";
