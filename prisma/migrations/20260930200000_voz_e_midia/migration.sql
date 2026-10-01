-- AlterTable
ALTER TABLE "Draft" ADD COLUMN     "asAudio" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "mediaKind" TEXT;

-- AlterTable
ALTER TABLE "Settings" ADD COLUMN     "voiceSettings" JSONB;

-- CreateTable
CREATE TABLE "OutgoingAudio" (
    "id" TEXT NOT NULL,
    "bytes" BYTEA NOT NULL,
    "mime" TEXT NOT NULL,
    "draftId" TEXT,
    "textHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OutgoingAudio_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OutgoingAudio_expiresAt_idx" ON "OutgoingAudio"("expiresAt");

-- CreateIndex
CREATE INDEX "OutgoingAudio_draftId_idx" ON "OutgoingAudio"("draftId");

