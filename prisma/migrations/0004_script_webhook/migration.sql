BEGIN;

ALTER TYPE "VideoStatus" ADD VALUE 'PENDING_SCRIPT' BEFORE 'PENDING';
ALTER TYPE "VideoStatus" ADD VALUE 'SCRIPT_GENERATING' BEFORE 'PENDING';

ALTER TABLE "video_generations" ADD COLUMN "scriptSubmissionId" TEXT;
CREATE UNIQUE INDEX "video_generations_scriptSubmissionId_key" ON "video_generations"("scriptSubmissionId");

COMMIT;
