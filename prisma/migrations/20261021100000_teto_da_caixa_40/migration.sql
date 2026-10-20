-- Teto padrão de e-mails por caixa sobe de 25 para 40 por dia (faixa que o mercado considera segura para e-mail frio).
-- O aquecimento continua igual (5 no primeiro dia, +1 por dia): caixa com menos de 3 semanas não muda; o teto novo só vale depois.
ALTER TABLE "Mailbox" ALTER COLUMN "dailyLimit" SET DEFAULT 40;
-- Caixas que ficaram no padrão antigo passam para o novo. Quem foi ajustado à mão para outro valor não muda.
UPDATE "Mailbox" SET "dailyLimit" = 40 WHERE "dailyLimit" = 25;

-- DESFAZER: ALTER TABLE "Mailbox" ALTER COLUMN "dailyLimit" SET DEFAULT 25; UPDATE "Mailbox" SET "dailyLimit" = 25 WHERE "dailyLimit" = 40;
