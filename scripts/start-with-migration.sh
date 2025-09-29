#!/bin/bash

# Run migrations at startup (runtime, not build time)
echo "[Migration] Running database migrations..."

# First, try to resolve any failed migrations
echo "[Migration] Attempting to resolve failed migrations..."
npx prisma migrate resolve --applied 20250915165122_init 2>&1 | tee /tmp/migration-resolve.log

# Then run migrations normally
npx prisma migrate deploy 2>&1 | tee /tmp/migration.log

if [ ${PIPESTATUS[0]} -eq 0 ]; then
    echo "[Migration] ✅ Migrations completed successfully"
else
    echo "[Migration] ⚠️ Migration failed, but continuing to start the application"
    echo "[Migration] Check /tmp/migration.log for details"
    echo "[Migration] Attempting manual migration fixes..."

    # If migration fails, DO NOT reset production data - log error and exit
    echo "[Migration] ❌ CRITICAL: Migration failed in production"
    echo "[Migration] ❌ REFUSING to reset database - this would destroy all data"
    echo "[Migration] ❌ Manual intervention required. Check logs and fix migrations manually"
    echo "[Migration] ❌ Application startup BLOCKED to prevent data loss"
    echo ""
    echo "MIGRATION FAILURE LOGS:"
    cat /tmp/migration.log
    echo ""
    echo "❌ DEPLOYMENT FAILED - DATABASE MIGRATION REQUIRED"
    exit 1
fi

# Start both the API server and Next.js frontend
echo "[Startup] Starting application..."
exec npm run start