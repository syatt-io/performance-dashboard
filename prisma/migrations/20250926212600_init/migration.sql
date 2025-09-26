-- CreateTable
CREATE TABLE "sites" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "monitoringEnabled" BOOLEAN NOT NULL DEFAULT true,
    "checkFrequency" INTEGER NOT NULL DEFAULT 360,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "performance_metrics" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "testLocation" TEXT,
    "deviceType" TEXT NOT NULL DEFAULT 'mobile',
    "performance" INTEGER,
    "accessibility" INTEGER,
    "bestPractices" INTEGER,
    "seo" INTEGER,
    "fcp" DOUBLE PRECISION,
    "si" DOUBLE PRECISION,
    "lcp" DOUBLE PRECISION,
    "tbt" DOUBLE PRECISION,
    "cls" DOUBLE PRECISION,
    "tti" DOUBLE PRECISION,
    "ttfb" DOUBLE PRECISION,
    "pageLoadTime" DOUBLE PRECISION,
    "pageSize" INTEGER,
    "requests" INTEGER,
    "errorDetails" TEXT,

    CONSTRAINT "performance_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduled_jobs" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "jobType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "error" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scheduled_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sites_url_key" ON "sites"("url");

-- CreateIndex
CREATE INDEX "performance_metrics_siteId_timestamp_idx" ON "performance_metrics"("siteId", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "scheduled_jobs_siteId_status_idx" ON "scheduled_jobs"("siteId", "status");

-- CreateIndex
CREATE INDEX "scheduled_jobs_scheduledFor_idx" ON "scheduled_jobs"("scheduledFor");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_key_key" ON "api_keys"("key");

-- AddForeignKey
ALTER TABLE "performance_metrics" ADD CONSTRAINT "performance_metrics_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_jobs" ADD CONSTRAINT "scheduled_jobs_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;