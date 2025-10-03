#!/bin/bash
set -e

echo "Starting application..."

# Run database migrations
echo "Running database migrations..."
npx prisma migrate deploy

# Start all services: Next.js on port 3000 (external), API on port 8080 (internal)
echo "Starting Next.js, API, worker, and scheduler..."
NODE_ENV=production npx concurrently \
  "PORT=3000 npx next start" \
  "PORT=8080 node dist/index.js" \
  "node dist/worker.js" \
  "node dist/scheduler.js"