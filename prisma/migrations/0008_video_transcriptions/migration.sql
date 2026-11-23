ALTER TABLE "contents"
ADD COLUMN "transcriptionStatus" "PreparationStatus" NOT NULL DEFAULT 'NOT_STARTED',
ADD COLUMN "transcriptionSubmissionId" TEXT,
ADD COLUMN "transcription" TEXT;

CREATE UNIQUE INDEX "contents_transcriptionSubmissionId_key" ON "contents"("transcriptionSubmissionId");
