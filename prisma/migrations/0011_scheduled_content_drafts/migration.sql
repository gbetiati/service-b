ALTER TABLE "content_scheduled"
  ALTER COLUMN "contentId" DROP NOT NULL,
  ADD COLUMN "contentDraft" JSONB,
  ADD COLUMN "contentCreationLeaseUntil" TIMESTAMP(3);

ALTER TABLE "content_scheduled"
  ADD CONSTRAINT "content_scheduled_content_or_draft_check"
  CHECK ("contentId" IS NOT NULL OR "contentDraft" IS NOT NULL),
  ADD CONSTRAINT "content_scheduled_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "content_scheduled_contentId_status_date_idx"
  ON "content_scheduled"("contentId", "status", "date");
