-- CreateIndex
CREATE INDEX "performance_metrics_siteId_deviceType_timestamp_idx" ON "public"."performance_metrics"("siteId", "deviceType", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "performance_metrics_timestamp_idx" ON "public"."performance_metrics"("timestamp" DESC);

-- CreateIndex
CREATE INDEX "performance_metrics_deviceType_timestamp_idx" ON "public"."performance_metrics"("deviceType", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "performance_metrics_page_type_idx" ON "public"."performance_metrics"("page_type");
