/*
  Warnings:

  - Made the column `page_type` on table `performance_metrics` required. This step will fail if there are existing NULL values in that column.
  - Made the column `is_shopify` on table `sites` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "public"."performance_metrics" ALTER COLUMN "page_type" SET NOT NULL;

-- AlterTable
ALTER TABLE "public"."performance_test_runs" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "public"."sites" ALTER COLUMN "is_shopify" SET NOT NULL;
