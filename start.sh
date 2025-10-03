#!/bin/bash
set -e

echo "Starting application..."

# Run database migrations
echo "Running database migrations..."
npx prisma migrate deploy

# Start all services including Next.js server
echo "Starting Next.js, API, worker, and scheduler..."
NODE_ENV=production PORT=3000 npx concurrently \
  "npx next start" \
  "node dist/index.js" \
  "node dist/worker.js" \
  "node dist/scheduler.js"