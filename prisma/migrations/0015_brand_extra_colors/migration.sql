-- Mais duas cores da marca, combinadas de forma variada nos anúncios.
ALTER TABLE "brands"
ADD COLUMN "tertiaryColor" TEXT,
ADD COLUMN "quaternaryColor" TEXT;
