#!/bin/sh
# Setup Google Service Account from environment variable

if [ -n "$GOOGLE_SERVICE_ACCOUNT_BASE64" ]; then
  echo "Setting up Google Service Account..."
  mkdir -p /app/config
  echo "$GOOGLE_SERVICE_ACCOUNT_BASE64" | base64 -d > /app/config/service-account.json
  export GOOGLE_APPLICATION_CREDENTIALS=/app/config/service-account.json
  echo "Service account configured at $GOOGLE_APPLICATION_CREDENTIALS"
else
  echo "No Google Service Account configured (GOOGLE_SERVICE_ACCOUNT_BASE64 not set)"
fi