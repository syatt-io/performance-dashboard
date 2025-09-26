-- CreateTable
CREATE TABLE "sites" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "shopifyDomain" TEXT,
    "apiKey" TEXT,
    "accessToken" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "performance_metrics" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "siteId" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deviceType" TEXT NOT NULL,
    "lcp" REAL,
    "fid" REAL,
    "cls" REAL,
    "inp" REAL,
    "fcp" REAL,
    "ttfb" REAL,
    "speedIndex" REAL,
    "performanceScore" INTEGER,
    "cartResponseTime" REAL,
    "checkoutStepTime" REAL,
    "themeAssetSize" INTEGER,
    "liquidRenderTime" REAL,
    "lighthouseData" JSONB,
    "userAgent" TEXT,
    "connectionType" TEXT,
    "location" TEXT,
    CONSTRAINT "performance_metrics_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "alerts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "siteId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "threshold" REAL NOT NULL,
    "currentValue" REAL NOT NULL,
    "message" TEXT NOT NULL,
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" DATETIME,
    CONSTRAINT "alerts_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "monitoring_jobs" (
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
    "metricId" TEXT
);

-- CreateIndex
CREATE UNIQUE INDEX "sites_url_key" ON "sites"("url");

-- CreateIndex
CREATE INDEX "performance_metrics_siteId_timestamp_idx" ON "performance_metrics"("siteId", "timestamp");

-- CreateIndex
CREATE INDEX "performance_metrics_timestamp_idx" ON "performance_metrics"("timestamp");

-- CreateIndex
CREATE INDEX "alerts_siteId_isResolved_idx" ON "alerts"("siteId", "isResolved");

-- CreateIndex
CREATE INDEX "alerts_createdAt_idx" ON "alerts"("createdAt");

-- CreateIndex
CREATE INDEX "monitoring_jobs_status_scheduledAt_idx" ON "monitoring_jobs"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "monitoring_jobs_siteId_jobType_idx" ON "monitoring_jobs"("siteId", "jobType");
