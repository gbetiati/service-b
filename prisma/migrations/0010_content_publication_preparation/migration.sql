ALTER TABLE "contents" ADD COLUMN "publicationPreparationRequested" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "content_scheduled"
  ADD COLUMN "socialAccountId" TEXT,
  ADD COLUMN "caption" TEXT,
  ADD COLUMN "preparationError" TEXT;

ALTER TABLE "content_scheduled" ADD CONSTRAINT "content_scheduled_companyId_socialAccountId_fkey"
  FOREIGN KEY ("companyId", "socialAccountId") REFERENCES "social_accounts"("companyId", "id")
  ON DELETE NO ACTION ON UPDATE CASCADE;
