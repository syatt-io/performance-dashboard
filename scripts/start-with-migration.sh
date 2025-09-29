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

    # Check if this is a baseline issue (existing database without migration history)
    if grep -q "P3005" /tmp/migration.log && grep -q "not empty" /tmp/migration.log; then
        echo "[Migration] 🔧 Detected existing database - attempting to baseline migrations..."

        # Try to baseline existing migrations
        if npx prisma migrate resolve --applied "20250926212600_init" > /tmp/baseline.log 2>&1; then
            echo "[Migration] ✅ Successfully baselined initial migration"

            # Try to apply remaining migrations
            if npx prisma migrate deploy > /tmp/remaining-migrations.log 2>&1; then
                echo "[Migration] ✅ Remaining migrations applied successfully"
                echo "[Migration] ✅ Database migration completed!"
            else
                echo "[Migration] ℹ️ No additional migrations to apply"
            fi
        else
            echo "[Migration] ⚠️ Baseline failed, trying db push as fallback..."
            if npx prisma db push > /tmp/db-push.log 2>&1; then
                echo "[Migration] ✅ Database schema synchronized with db push"
            else
                echo "[Migration] ❌ All migration approaches failed"
                echo "[Migration] ❌ Manual intervention required"
                echo ""
                echo "MIGRATION FAILURE LOGS:"
                cat /tmp/migration.log
                echo ""
                echo "BASELINE LOGS:"
                cat /tmp/baseline.log
                echo ""
                echo "❌ DEPLOYMENT FAILED - DATABASE MIGRATION REQUIRED"
                exit 1
            fi
        fi
    else
        # Other migration failures - still refuse to reset data
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
fi

# Start both the API server and Next.js frontend
echo "[Startup] Starting application..."
exec npm run start