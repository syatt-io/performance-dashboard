-- AlterTable
ALTER TABLE "public"."performance_metrics" ADD COLUMN     "imageOptimizationScore" DOUBLE PRECISION,
ADD COLUMN     "themeAssetSize" DOUBLE PRECISION,
ADD COLUMN     "thirdPartyBlockingTime" DOUBLE PRECISION;
