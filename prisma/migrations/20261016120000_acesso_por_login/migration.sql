-- Acesso individual: entra por login (nome) em vez de e-mail.
ALTER TABLE "PanelUser" RENAME COLUMN "email" TO "login";
ALTER INDEX IF EXISTS "PanelUser_email_key" RENAME TO "PanelUser_login_key";
UPDATE "PanelUser" SET "login" = 'lucas' WHERE "login" = 'eu@lucasprestes.com' AND NOT EXISTS (SELECT 1 FROM "PanelUser" WHERE "login" = 'lucas');
