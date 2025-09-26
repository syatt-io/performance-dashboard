-- AlterTable
ALTER TABLE "performance_metrics" ADD COLUMN "bytesIn" INTEGER;
ALTER TABLE "performance_metrics" ADD COLUMN "fullyLoadedTime" REAL;
ALTER TABLE "performance_metrics" ADD COLUMN "loadTime" REAL;
ALTER TABLE "performance_metrics" ADD COLUMN "requests" INTEGER;
ALTER TABLE "performance_metrics" ADD COLUMN "testId" TEXT;
ALTER TABLE "performance_metrics" ADD COLUMN "testProvider" TEXT;
ALTER TABLE "performance_metrics" ADD COLUMN "visualProgress" JSONB;
