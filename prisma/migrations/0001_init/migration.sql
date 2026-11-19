CREATE EXTENSION IF NOT EXISTS vector;

-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('APPROVED', 'REPROVED', 'WAITING', 'ERROR');

-- CreateEnum
CREATE TYPE "VideoStatus" AS ENUM ('PENDING', 'SUBMITTING', 'RENDERING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "SocialPlatform" AS ENUM ('INSTAGRAM');

-- CreateEnum
CREATE TYPE "SocialAccountStatus" AS ENUM ('ACTIVE', 'DISCONNECTED');

-- CreateEnum
CREATE TYPE "PublicationStatus" AS ENUM ('SCHEDULED', 'PUBLISHING', 'PUBLISHED', 'FAILED');

-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brands" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaigns" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "objective" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_rules" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "campaingId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "guidelines" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaign_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_categories" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "categoryId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_assets" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contents" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "campaingId" TEXT NOT NULL,
    "campaingRulesId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "aiScript" TEXT NOT NULL,
    "status" "ContentStatus" NOT NULL DEFAULT 'WAITING',
    "editorial" JSONB NOT NULL DEFAULT '{}',
    "embedding" vector(1536),
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_products" (
    "companyId" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_products_pkey" PRIMARY KEY ("companyId","contentId","productId")
);

-- CreateTable
CREATE TABLE "content_scenes" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_scenes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_assets" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "mediaAssetId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_history" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "video_generations" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "input" JSONB NOT NULL,
    "status" "VideoStatus" NOT NULL DEFAULT 'PENDING',
    "providerId" TEXT,
    "error" TEXT,
    "nextCheckAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leaseUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "video_generations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "video_assets" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "generationId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "reviewStatus" "ContentStatus" NOT NULL,
    "review" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "video_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_accounts" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "platform" "SocialPlatform" NOT NULL,
    "externalId" TEXT NOT NULL,
    "accountHandle" TEXT NOT NULL,
    "displayName" TEXT,
    "status" "SocialAccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "social_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_credentials" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "socialAccountId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "encryptedValue" TEXT NOT NULL,
    "initializationVector" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "scopes" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "social_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oauth_states" (
    "hash" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "oauth_states_pkey" PRIMARY KEY ("hash")
);

-- CreateTable
CREATE TABLE "content_scheduled" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "status" "ContentStatus" NOT NULL DEFAULT 'WAITING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_scheduled_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "publications" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "socialAccountId" TEXT NOT NULL,
    "status" "PublicationStatus" NOT NULL DEFAULT 'SCHEDULED',
    "caption" TEXT,
    "containerId" TEXT,
    "externalId" TEXT,
    "error" TEXT,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL,
    "leaseUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "publications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_companyId_id_key" ON "users"("companyId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "brands_companyId_id_key" ON "brands"("companyId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "campaigns_companyId_id_key" ON "campaigns"("companyId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_rules_companyId_id_key" ON "campaign_rules"("companyId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_rules_companyId_campaingId_id_key" ON "campaign_rules"("companyId", "campaingId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "product_categories_companyId_id_key" ON "product_categories"("companyId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "products_companyId_id_key" ON "products"("companyId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "media_assets_storageKey_key" ON "media_assets"("storageKey");

-- CreateIndex
CREATE INDEX "media_assets_companyId_productId_idx" ON "media_assets"("companyId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "media_assets_companyId_id_key" ON "media_assets"("companyId", "id");

-- CreateIndex
CREATE INDEX "contents_companyId_createdAt_idx" ON "contents"("companyId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "contents_companyId_id_key" ON "contents"("companyId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "content_scenes_companyId_contentId_position_key" ON "content_scenes"("companyId", "contentId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "content_assets_companyId_contentId_mediaAssetId_key" ON "content_assets"("companyId", "contentId", "mediaAssetId");

-- CreateIndex
CREATE UNIQUE INDEX "content_history_companyId_contentId_revision_key" ON "content_history"("companyId", "contentId", "revision");

-- CreateIndex
CREATE UNIQUE INDEX "video_generations_providerId_key" ON "video_generations"("providerId");

-- CreateIndex
CREATE INDEX "video_generations_status_nextCheckAt_idx" ON "video_generations"("status", "nextCheckAt");

-- CreateIndex
CREATE UNIQUE INDEX "video_generations_companyId_contentId_revision_key" ON "video_generations"("companyId", "contentId", "revision");

-- CreateIndex
CREATE UNIQUE INDEX "video_generations_companyId_contentId_id_key" ON "video_generations"("companyId", "contentId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "video_assets_storageKey_key" ON "video_assets"("storageKey");

-- CreateIndex
CREATE UNIQUE INDEX "video_assets_companyId_contentId_generationId_key" ON "video_assets"("companyId", "contentId", "generationId");

-- CreateIndex
CREATE UNIQUE INDEX "video_assets_companyId_contentId_id_key" ON "video_assets"("companyId", "contentId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "social_accounts_companyId_platform_accountHandle_key" ON "social_accounts"("companyId", "platform", "accountHandle");

-- CreateIndex
CREATE UNIQUE INDEX "social_accounts_companyId_platform_externalId_key" ON "social_accounts"("companyId", "platform", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "social_accounts_companyId_id_key" ON "social_accounts"("companyId", "id");

-- CreateIndex
CREATE INDEX "social_credentials_socialAccountId_kind_idx" ON "social_credentials"("socialAccountId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "social_credentials_companyId_socialAccountId_kind_key" ON "social_credentials"("companyId", "socialAccountId", "kind");

-- CreateIndex
CREATE INDEX "oauth_states_expiresAt_idx" ON "oauth_states"("expiresAt");

-- CreateIndex
CREATE INDEX "content_scheduled_companyId_date_idx" ON "content_scheduled"("companyId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "content_scheduled_companyId_id_key" ON "content_scheduled"("companyId", "id");

-- CreateIndex
CREATE INDEX "publications_status_nextAttemptAt_idx" ON "publications"("status", "nextAttemptAt");

-- CreateIndex
CREATE UNIQUE INDEX "publications_companyId_scheduleId_key" ON "publications"("companyId", "scheduleId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brands" ADD CONSTRAINT "brands_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_companyId_brandId_fkey" FOREIGN KEY ("companyId", "brandId") REFERENCES "brands"("companyId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_rules" ADD CONSTRAINT "campaign_rules_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_rules" ADD CONSTRAINT "campaign_rules_companyId_campaingId_fkey" FOREIGN KEY ("companyId", "campaingId") REFERENCES "campaigns"("companyId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_companyId_brandId_fkey" FOREIGN KEY ("companyId", "brandId") REFERENCES "brands"("companyId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Check non-cascading references at commit so the tenant cascades can finish.
ALTER TABLE "products" ADD CONSTRAINT "products_companyId_categoryId_fkey" FOREIGN KEY ("companyId", "categoryId") REFERENCES "product_categories"("companyId", "id") ON DELETE NO ACTION ON UPDATE CASCADE DEFERRABLE INITIALLY DEFERRED;

-- AddForeignKey
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_companyId_productId_fkey" FOREIGN KEY ("companyId", "productId") REFERENCES "products"("companyId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contents" ADD CONSTRAINT "contents_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contents" ADD CONSTRAINT "contents_companyId_campaingId_fkey" FOREIGN KEY ("companyId", "campaingId") REFERENCES "campaigns"("companyId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contents" ADD CONSTRAINT "contents_companyId_campaingId_campaingRulesId_fkey" FOREIGN KEY ("companyId", "campaingId", "campaingRulesId") REFERENCES "campaign_rules"("companyId", "campaingId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contents" ADD CONSTRAINT "contents_companyId_productId_fkey" FOREIGN KEY ("companyId", "productId") REFERENCES "products"("companyId", "id") ON DELETE NO ACTION ON UPDATE CASCADE DEFERRABLE INITIALLY DEFERRED;

-- AddForeignKey
ALTER TABLE "content_products" ADD CONSTRAINT "content_products_companyId_contentId_fkey" FOREIGN KEY ("companyId", "contentId") REFERENCES "contents"("companyId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_products" ADD CONSTRAINT "content_products_companyId_productId_fkey" FOREIGN KEY ("companyId", "productId") REFERENCES "products"("companyId", "id") ON DELETE NO ACTION ON UPDATE CASCADE DEFERRABLE INITIALLY DEFERRED;

-- AddForeignKey
ALTER TABLE "content_scenes" ADD CONSTRAINT "content_scenes_companyId_contentId_fkey" FOREIGN KEY ("companyId", "contentId") REFERENCES "contents"("companyId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_assets" ADD CONSTRAINT "content_assets_companyId_contentId_fkey" FOREIGN KEY ("companyId", "contentId") REFERENCES "contents"("companyId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_assets" ADD CONSTRAINT "content_assets_companyId_mediaAssetId_fkey" FOREIGN KEY ("companyId", "mediaAssetId") REFERENCES "media_assets"("companyId", "id") ON DELETE NO ACTION ON UPDATE CASCADE DEFERRABLE INITIALLY DEFERRED;

-- AddForeignKey
ALTER TABLE "content_history" ADD CONSTRAINT "content_history_companyId_contentId_fkey" FOREIGN KEY ("companyId", "contentId") REFERENCES "contents"("companyId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_generations" ADD CONSTRAINT "video_generations_companyId_contentId_fkey" FOREIGN KEY ("companyId", "contentId") REFERENCES "contents"("companyId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_assets" ADD CONSTRAINT "video_assets_companyId_contentId_fkey" FOREIGN KEY ("companyId", "contentId") REFERENCES "contents"("companyId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_assets" ADD CONSTRAINT "video_assets_companyId_contentId_generationId_fkey" FOREIGN KEY ("companyId", "contentId", "generationId") REFERENCES "video_generations"("companyId", "contentId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_accounts" ADD CONSTRAINT "social_accounts_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_credentials" ADD CONSTRAINT "social_credentials_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_credentials" ADD CONSTRAINT "social_credentials_companyId_socialAccountId_fkey" FOREIGN KEY ("companyId", "socialAccountId") REFERENCES "social_accounts"("companyId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oauth_states" ADD CONSTRAINT "oauth_states_companyId_userId_fkey" FOREIGN KEY ("companyId", "userId") REFERENCES "users"("companyId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_scheduled" ADD CONSTRAINT "content_scheduled_companyId_contentId_fkey" FOREIGN KEY ("companyId", "contentId") REFERENCES "contents"("companyId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_scheduled" ADD CONSTRAINT "content_scheduled_companyId_contentId_videoId_fkey" FOREIGN KEY ("companyId", "contentId", "videoId") REFERENCES "video_assets"("companyId", "contentId", "id") ON DELETE NO ACTION ON UPDATE CASCADE DEFERRABLE INITIALLY DEFERRED;

-- AddForeignKey
ALTER TABLE "publications" ADD CONSTRAINT "publications_companyId_scheduleId_fkey" FOREIGN KEY ("companyId", "scheduleId") REFERENCES "content_scheduled"("companyId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publications" ADD CONSTRAINT "publications_companyId_socialAccountId_fkey" FOREIGN KEY ("companyId", "socialAccountId") REFERENCES "social_accounts"("companyId", "id") ON DELETE NO ACTION ON UPDATE CASCADE DEFERRABLE INITIALLY DEFERRED;

