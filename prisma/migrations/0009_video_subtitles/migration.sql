ALTER TABLE "contents"
ADD COLUMN "subtitleSrt" TEXT,
ADD COLUMN "subtitleStatus" "PreparationStatus" NOT NULL DEFAULT 'NOT_STARTED',
ADD COLUMN "subtitleLeaseUntil" TIMESTAMP(3);

ALTER TABLE "video_assets" ADD COLUMN "captionedStorageKey" TEXT;

-- Request timed subtitles for revisions processed before SRT output was enabled.
UPDATE "contents" SET "transcriptionStatus" = 'NOT_STARTED', "transcriptionSubmissionId" = NULL
WHERE "transcriptionStatus" IN ('READY', 'PENDING');
