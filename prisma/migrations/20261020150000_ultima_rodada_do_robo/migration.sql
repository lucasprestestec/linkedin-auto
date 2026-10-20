-- Quando o robô rodou pela última vez (a central local avisa se o agendador parou).
ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "lastRobotRunAt" TIMESTAMP(3);
