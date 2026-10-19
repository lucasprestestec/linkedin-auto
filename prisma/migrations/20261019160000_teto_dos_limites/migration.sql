-- Teto dos limites diários do LinkedIn: o cliente escolhe até este valor; o dono muda na central.
ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "dailyInviteMax" INTEGER NOT NULL DEFAULT 25;
ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "dailyMessageMax" INTEGER NOT NULL DEFAULT 40;
-- Quem já passa do teto novo fica no teto (nenhuma instalação atual passa).
UPDATE "Settings" SET "dailyInviteLimit" = LEAST("dailyInviteLimit", "dailyInviteMax"), "dailyMessageLimit" = LEAST("dailyMessageLimit", "dailyMessageMax");
