#!/bin/bash

# Run migrations at startup (runtime, not build time)
echo "[Migration] Running database migrations..."
npx prisma migrate deploy 2>&1 | tee /tmp/migration.log

if [ ${PIPESTATUS[0]} -eq 0 ]; then
    echo "[Migration] ✅ Migrations completed successfully"
else
    echo "[Migration] ⚠️ Migration failed, but continuing to start the application"
    echo "[Migration] Check /tmp/migration.log for details"
fi

# Start both the API server and Next.js frontend
echo "[Startup] Starting application..."
exec npm run start