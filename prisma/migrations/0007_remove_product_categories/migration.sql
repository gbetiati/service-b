BEGIN;

ALTER TABLE "products" DROP CONSTRAINT "products_companyId_categoryId_fkey";
ALTER TABLE "products" DROP COLUMN "categoryId";
DROP TABLE "product_categories";

COMMIT;
