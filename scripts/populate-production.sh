#!/bin/bash

API_URL="https://performance-dashboard-p7pf5.ondigitalocean.app/api"
SITE_ID="8f26bfe2-2aa7-4345-8fd3-0a2e625b5471"  # Example Store
SECRET_KEY="temp-migration-key-2024"

echo "Adding sample metrics to production database..."
echo "Site ID: $SITE_ID"
echo ""

# Function to generate metrics for a specific date
generate_metrics() {
  local date=$1
  local device=$2

  # Base values with some variation
  if [ "$device" = "mobile" ]; then
    perf=$((90 + RANDOM % 10))
    fcp=$(echo "scale=2; 1.0 + $RANDOM/32768*0.5" | bc)
    lcp=$(echo "scale=2; 2.2 + $RANDOM/32768*0.6" | bc)
    cls=$(echo "scale=3; 0.04 + $RANDOM/32768*0.03" | bc)
    tti=$(echo "scale=2; 3.5 + $RANDOM/32768*0.5" | bc)
    si=$(echo "scale=2; 2.0 + $RANDOM/32768*0.4" | bc)
    tbt=$((120 + RANDOM % 80))
    ttfb=$((700 + RANDOM % 200))
    page_load=$(echo "scale=2; 4.0 + $RANDOM/32768*0.5" | bc)
  else
    perf=$((94 + RANDOM % 6))
    fcp=$(echo "scale=2; 0.7 + $RANDOM/32768*0.3" | bc)
    lcp=$(echo "scale=2; 1.6 + $RANDOM/32768*0.4" | bc)
    cls=$(echo "scale=3; 0.02 + $RANDOM/32768*0.02" | bc)
    tti=$(echo "scale=2; 2.3 + $RANDOM/32768*0.4" | bc)
    si=$(echo "scale=2; 1.4 + $RANDOM/32768*0.3" | bc)
    tbt=$((40 + RANDOM % 60))
    ttfb=$((500 + RANDOM % 200))
    page_load=$(echo "scale=2; 3.0 + $RANDOM/32768*0.4" | bc)
  fi

  cat <<EOF
{
  "timestamp": "${date}T12:00:00Z",
  "deviceType": "$device",
  "performance": $perf,
  "accessibility": 98,
  "bestPractices": 92,
  "seo": 100,
  "fcp": $fcp,
  "si": $si,
  "lcp": $lcp,
  "cls": $cls,
  "tti": $tti,
  "tbt": $tbt,
  "ttfb": $ttfb,
  "pageLoadTime": $page_load,
  "pageSize": 1024000,
  "requests": 45
}
EOF
}

# Generate metrics for the last 7 days
METRICS="["
for days_ago in {6..0}; do
  date=$(date -v-${days_ago}d +%Y-%m-%d 2>/dev/null || date -d "${days_ago} days ago" +%Y-%m-%d)

  # Add mobile metric
  if [ "$METRICS" != "[" ]; then
    METRICS="$METRICS,"
  fi
  METRICS="$METRICS$(generate_metrics $date mobile)"

  # Add desktop metric
  METRICS="$METRICS,$(generate_metrics $date desktop)"
done
METRICS="$METRICS]"

# Send the request
echo "Sending metrics to production API..."
response=$(curl -s -X POST "$API_URL/admin/add-sample-metrics" \
  -H "x-migration-key: $SECRET_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"siteId\": \"$SITE_ID\", \"metrics\": $METRICS}")

echo "Response: $response"
echo ""
echo "Done! Check https://performance-dashboard-p7pf5.ondigitalocean.app to see the metrics"