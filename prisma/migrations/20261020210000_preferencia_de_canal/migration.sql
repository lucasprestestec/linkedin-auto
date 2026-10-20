-- Preferência de canal por pessoa. Só acrescenta colunas; nada existente muda.
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "preferredChannel" "MessageChannel";
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "blockedChannels" "MessageChannel"[] DEFAULT ARRAY[]::"MessageChannel"[];

-- DESFAZER: ALTER TABLE "Lead" DROP COLUMN "preferredChannel", DROP COLUMN "blockedChannels";
