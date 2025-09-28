-- Add page URL fields to sites table
ALTER TABLE "sites"
ADD COLUMN "category_url" TEXT,
ADD COLUMN "product_url" TEXT,
ADD COLUMN "is_shopify" BOOLEAN DEFAULT true;

-- Add page type field to performance_metrics
ALTER TABLE "performance_metrics"
ADD COLUMN "page_type" TEXT DEFAULT 'homepage';

-- Create table for individual test runs (raw data)
CREATE TABLE "performance_test_runs" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  "site_id" TEXT NOT NULL,
  "page_type" TEXT NOT NULL DEFAULT 'homepage',
  "page_url" TEXT NOT NULL,
  "device_type" TEXT NOT NULL DEFAULT 'mobile',
  "run_number" INTEGER NOT NULL,
  "batch_id" TEXT NOT NULL,
  "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Lighthouse scores
  "performance" INTEGER,
  "accessibility" INTEGER,
  "best_practices" INTEGER,
  "seo" INTEGER,

  -- Core Web Vitals
  "fcp" DOUBLE PRECISION,
  "si" DOUBLE PRECISION,
  "lcp" DOUBLE PRECISION,
  "tbt" DOUBLE PRECISION,
  "cls" DOUBLE PRECISION,
  "tti" DOUBLE PRECISION,
  "ttfb" DOUBLE PRECISION,

  -- Page metrics
  "page_load_time" DOUBLE PRECISION,
  "page_size" INTEGER,
  "requests" INTEGER,

  "error_details" TEXT,

  CONSTRAINT "performance_test_runs_site_id_fkey"
    FOREIGN KEY ("site_id")
    REFERENCES "sites"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

-- Add indices for performance
CREATE INDEX "performance_test_runs_site_id_idx" ON "performance_test_runs"("site_id");
CREATE INDEX "performance_test_runs_batch_id_idx" ON "performance_test_runs"("batch_id");
CREATE INDEX "performance_test_runs_timestamp_idx" ON "performance_test_runs"("timestamp" DESC);

-- Add comment explaining the purpose
COMMENT ON TABLE "performance_test_runs" IS 'Stores individual test run data for calculating medians across multiple runs';
COMMENT ON COLUMN "performance_test_runs"."batch_id" IS 'Groups runs that belong to the same testing session';
COMMENT ON COLUMN "performance_test_runs"."run_number" IS 'Sequential number of the run within a batch (1, 2, 3)';