-- Convites já pedidos à edges.run e ainda sem retorno: contam no limite diário e no limite da campanha.
CREATE TABLE "InviteScheduled" (
    "id" TEXT NOT NULL,
    "profileUrl" TEXT NOT NULL,
    "campaignId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InviteScheduled_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "InviteScheduled_profileUrl_key" ON "InviteScheduled"("profileUrl");
