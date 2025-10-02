-- CreateTable
CREATE TABLE "public"."third_party_scripts" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "vendor" TEXT,
    "category" TEXT,
    "is_blocking" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "third_party_scripts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."third_party_script_detections" (
    "id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "script_id" TEXT NOT NULL,
    "metric_id" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "page_type" TEXT NOT NULL DEFAULT 'homepage',
    "page_url" TEXT NOT NULL,
    "device_type" TEXT NOT NULL DEFAULT 'mobile',
    "transfer_size" INTEGER,
    "resource_size" INTEGER,
    "start_time" DOUBLE PRECISION,
    "duration" DOUBLE PRECISION,
    "blocking_time" DOUBLE PRECISION,

    CONSTRAINT "third_party_script_detections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "third_party_scripts_url_key" ON "public"."third_party_scripts"("url");

-- CreateIndex
CREATE INDEX "third_party_scripts_domain_idx" ON "public"."third_party_scripts"("domain");

-- CreateIndex
CREATE INDEX "third_party_scripts_vendor_idx" ON "public"."third_party_scripts"("vendor");

-- CreateIndex
CREATE INDEX "third_party_scripts_category_idx" ON "public"."third_party_scripts"("category");

-- CreateIndex
CREATE INDEX "third_party_script_detections_site_id_timestamp_idx" ON "public"."third_party_script_detections"("site_id", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "third_party_script_detections_script_id_timestamp_idx" ON "public"."third_party_script_detections"("script_id", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "third_party_script_detections_site_id_script_id_timestamp_idx" ON "public"."third_party_script_detections"("site_id", "script_id", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "third_party_script_detections_page_type_idx" ON "public"."third_party_script_detections"("page_type");

-- AddForeignKey
ALTER TABLE "public"."third_party_script_detections" ADD CONSTRAINT "third_party_script_detections_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."third_party_script_detections" ADD CONSTRAINT "third_party_script_detections_script_id_fkey" FOREIGN KEY ("script_id") REFERENCES "public"."third_party_scripts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
