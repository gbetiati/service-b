-- Identidade visual e de comunicação da marca, usadas para elaborar o brief dos vídeos.
ALTER TABLE "brands"
ADD COLUMN "primaryColor" TEXT,
ADD COLUMN "secondaryColor" TEXT,
ADD COLUMN "voiceTone" TEXT,
ADD COLUMN "targetAudience" TEXT,
ADD COLUMN "copyGuidelines" TEXT;
