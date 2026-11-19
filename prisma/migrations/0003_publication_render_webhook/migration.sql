BEGIN;

ALTER TYPE "ContentStatus" ADD VALUE IF NOT EXISTS 'READY' BEFORE 'APPROVED';
ALTER TABLE "content_scheduled" ALTER COLUMN "videoId" DROP NOT NULL;
ALTER TABLE "video_generations" ADD COLUMN "submissionId" TEXT;
CREATE UNIQUE INDEX "video_generations_submissionId_key" ON "video_generations"("submissionId");

-- Renders submitted by the old worker have no callback configured.
UPDATE "video_generations"
SET "status" = 'FAILED', "error" = 'Solicite novamente o render para ativar o webhook.', "leaseUntil" = NULL
WHERE "status" IN ('PENDING', 'SUBMITTING', 'RENDERING');

DROP INDEX "video_generations_status_nextCheckAt_idx";
ALTER TABLE "video_generations" DROP COLUMN "nextCheckAt";

COMMIT;
