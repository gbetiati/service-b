-- Tipo da foto do produto (só o produto ou com pessoas) e configuração dos templates de foto por empresa: o tipo de
-- foto preferido em cada cena. As fotos existentes ficam como PRODUCT.

-- CreateEnum
CREATE TYPE "MediaAssetKind" AS ENUM ('PRODUCT', 'PERSON');

-- AlterTable
ALTER TABLE "media_assets" ADD COLUMN     "kind" "MediaAssetKind" NOT NULL DEFAULT 'PRODUCT';

-- CreateTable
CREATE TABLE "image_template_settings" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "slotKinds" "MediaAssetKind"[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "image_template_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "image_template_settings_companyId_template_key" ON "image_template_settings"("companyId", "template");

-- AddForeignKey
ALTER TABLE "image_template_settings" ADD CONSTRAINT "image_template_settings_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

