-- CreateTable
CREATE TABLE "public"."recommendations" (
    "id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "metric_id" TEXT,
    "severity" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "actionable_steps" TEXT NOT NULL,
    "estimated_impact" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."anomalies" (
    "id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "metric_id" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "current_value" DOUBLE PRECISION NOT NULL,
    "expected_min" DOUBLE PRECISION NOT NULL,
    "expected_max" DOUBLE PRECISION NOT NULL,
    "standard_deviations" DOUBLE PRECISION NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "anomalies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "recommendations_site_id_status_idx" ON "public"."recommendations"("site_id", "status");

-- CreateIndex
CREATE INDEX "recommendations_site_id_created_at_idx" ON "public"."recommendations"("site_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "recommendations_severity_status_idx" ON "public"."recommendations"("severity", "status");

-- CreateIndex
CREATE INDEX "anomalies_site_id_status_idx" ON "public"."anomalies"("site_id", "status");

-- CreateIndex
CREATE INDEX "anomalies_site_id_created_at_idx" ON "public"."anomalies"("site_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "anomalies_metric_status_idx" ON "public"."anomalies"("metric", "status");

-- AddForeignKey
ALTER TABLE "public"."recommendations" ADD CONSTRAINT "recommendations_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."anomalies" ADD CONSTRAINT "anomalies_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
