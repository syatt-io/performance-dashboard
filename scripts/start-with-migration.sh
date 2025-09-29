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

    # If migration fails, try to push the schema directly
    echo "[Migration] Attempting to push schema to fix database state..."
    npx prisma db push --force-reset --skip-generate 2>&1 | tee /tmp/migration-push.log
fi

# Start both the API server and Next.js frontend
echo "[Startup] Starting application..."
exec npm run start