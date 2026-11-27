-- Onboarding: perfil do negócio na empresa e sessões de varredura do site e do Instagram.
-- CreateEnum
CREATE TYPE "OnboardingStatus" AS ENUM ('RESEARCHING', 'READY', 'FAILED', 'COMPLETED');

-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "description" TEXT,
ADD COLUMN     "instagramHandle" TEXT,
ADD COLUMN     "onboardedAt" TIMESTAMP(3),
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "segment" TEXT,
ADD COLUMN     "serviceArea" TEXT,
ADD COLUMN     "website" TEXT;

-- CreateTable
CREATE TABLE "onboarding_sessions" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "websiteUrl" TEXT,
    "instagramHandle" TEXT,
    "status" "OnboardingStatus" NOT NULL DEFAULT 'RESEARCHING',
    "stage" TEXT,
    "findings" JSONB,
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "leaseUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "onboarding_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "onboarding_sessions_status_leaseUntil_idx" ON "onboarding_sessions"("status", "leaseUntil");

-- CreateIndex
CREATE INDEX "onboarding_sessions_companyId_createdAt_idx" ON "onboarding_sessions"("companyId", "createdAt");

-- AddForeignKey
ALTER TABLE "onboarding_sessions" ADD CONSTRAINT "onboarding_sessions_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Empresas que já existiam não passam pelo onboarding.
UPDATE "companies" SET "onboardedAt" = CURRENT_TIMESTAMP WHERE "onboardedAt" IS NULL;
