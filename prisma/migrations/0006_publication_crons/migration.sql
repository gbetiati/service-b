BEGIN;

DROP INDEX "publications_status_nextAttemptAt_idx";
ALTER TABLE "publications" DROP COLUMN "nextAttemptAt";
CREATE INDEX "publications_status_updatedAt_idx" ON "publications"("status", "updatedAt");

COMMIT;
