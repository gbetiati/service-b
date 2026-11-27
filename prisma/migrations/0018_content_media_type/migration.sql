-- Tipo de mídia do conteúdo. Os conteúdos existentes foram montados com fotos.
CREATE TYPE "ContentMediaType" AS ENUM ('IMAGE', 'VIDEO');

ALTER TABLE "contents" ADD COLUMN "contentMediaType" "ContentMediaType" NOT NULL DEFAULT 'IMAGE';
