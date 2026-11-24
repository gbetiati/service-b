-- CreateEnum
CREATE TYPE "ProductVideoStatus" AS ENUM ('QUEUED', 'GENERATING_COPY', 'RENDERING', 'UPLOADING', 'DONE', 'FAILED');

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "oldPrice" DECIMAL(12,2),
ADD COLUMN     "price" DECIMAL(12,2);

-- CreateTable
CREATE TABLE "product_video_jobs" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "templateId" TEXT NOT NULL DEFAULT 'default',
    "cacheKey" TEXT NOT NULL,
    "status" "ProductVideoStatus" NOT NULL DEFAULT 'QUEUED',
    "copy" JSONB,
    "outputKey" TEXT,
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_video_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_video_jobs_companyId_createdAt_idx" ON "product_video_jobs"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "product_video_jobs_cacheKey_idx" ON "product_video_jobs"("cacheKey");

-- CreateIndex
CREATE INDEX "product_video_jobs_status_updatedAt_idx" ON "product_video_jobs"("status", "updatedAt");

