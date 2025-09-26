-- AlterTable
ALTER TABLE "performance_metrics" ADD COLUMN "imageOptimizationScore" INTEGER;
ALTER TABLE "performance_metrics" ADD COLUMN "thirdPartyBlockingTime" REAL;

-- CreateTable
CREATE TABLE "performance_budgets" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "siteId" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "deviceType" TEXT NOT NULL,
    "warningThreshold" REAL NOT NULL,
    "criticalThreshold" REAL NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "alertOnRegression" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "performance_budgets_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_monitoring_jobs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "siteId" TEXT NOT NULL,
    "jobType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "deviceType" TEXT,
    "scheduledAt" DATETIME NOT NULL,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "errorMessage" TEXT,
    "config" JSONB,
    "metricId" TEXT,
    CONSTRAINT "monitoring_jobs_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_monitoring_jobs" ("completedAt", "config", "deviceType", "errorMessage", "id", "jobType", "metricId", "scheduledAt", "siteId", "startedAt", "status") SELECT "completedAt", "config", "deviceType", "errorMessage", "id", "jobType", "metricId", "scheduledAt", "siteId", "startedAt", "status" FROM "monitoring_jobs";
DROP TABLE "monitoring_jobs";
ALTER TABLE "new_monitoring_jobs" RENAME TO "monitoring_jobs";
CREATE INDEX "monitoring_jobs_status_scheduledAt_idx" ON "monitoring_jobs"("status", "scheduledAt");
CREATE INDEX "monitoring_jobs_siteId_jobType_idx" ON "monitoring_jobs"("siteId", "jobType");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "performance_budgets_siteId_metric_deviceType_key" ON "performance_budgets"("siteId", "metric", "deviceType");
