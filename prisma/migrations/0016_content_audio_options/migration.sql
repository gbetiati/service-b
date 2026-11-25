-- Opções de áudio do anúncio por conteúdo: música de fundo e locução (TTS) do roteiro.
ALTER TABLE "contents" ADD COLUMN "backgroundMusic" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "contents" ADD COLUMN "voiceover" BOOLEAN NOT NULL DEFAULT false;
