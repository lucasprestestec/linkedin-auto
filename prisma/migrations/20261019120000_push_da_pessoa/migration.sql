-- Quem cadastrou o aviso no celular (para parar os avisos quando a pessoa for desativada).
ALTER TABLE "PushSubscription" ADD COLUMN IF NOT EXISTS "userId" TEXT;
