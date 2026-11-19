BEGIN;

CREATE TYPE "PreparationStatus" AS ENUM ('NOT_STARTED', 'PENDING', 'READY', 'FAILED');

ALTER TABLE "contents"
  ADD COLUMN "scriptStatus" "PreparationStatus" NOT NULL DEFAULT 'NOT_STARTED',
  ADD COLUMN "videoStatus" "PreparationStatus" NOT NULL DEFAULT 'NOT_STARTED';

UPDATE "contents" SET "scriptStatus" = 'READY' WHERE btrim("aiScript") <> '';

UPDATE "contents" AS c
SET "scriptStatus" = (CASE
      WHEN g.status IN ('PENDING_SCRIPT', 'SCRIPT_GENERATING') THEN 'PENDING'
      WHEN g.status = 'FAILED' AND g."scriptSubmissionId" IS NOT NULL
        AND g."submissionId" IS NULL AND coalesce(g.input ->> 'script', '') = '' THEN 'FAILED'
      WHEN btrim(c."aiScript") <> '' THEN 'READY'
      ELSE 'NOT_STARTED' END)::"PreparationStatus",
    "videoStatus" = (CASE
      WHEN g.status = 'READY' THEN 'READY'
      WHEN g.status IN ('SUBMITTING', 'RENDERING') THEN 'PENDING'
      WHEN g.status = 'FAILED' AND g."submissionId" IS NOT NULL THEN 'FAILED'
      ELSE 'NOT_STARTED' END)::"PreparationStatus"
FROM "video_generations" AS g
WHERE g."companyId" = c."companyId" AND g."contentId" = c.id AND g.revision = c.revision;

COMMIT;
