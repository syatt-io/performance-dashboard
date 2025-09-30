#!/bin/bash
set -e

echo "🔄 Syncing Production Database to Local Environment"
echo ""

# Production database credentials
# Get these from: doctl databases connection YOUR_DB_ID
PROD_HOST="${PROD_DB_HOST:-app-3e774e03-7ffb-4138-a401-13c2fd3f09b4-do-user-9115787-0.m.db.ondigitalocean.com}"
PROD_PORT="${PROD_DB_PORT:-25060}"
PROD_USER="${PROD_DB_USER:-doadmin}"
PROD_DB="${PROD_DB_NAME:-defaultdb}"
PROD_PASSWORD="${PROD_DB_PASSWORD:?Error: PROD_DB_PASSWORD environment variable is required}"

# Local database credentials (from docker-compose.dev.yml)
LOCAL_HOST="localhost"
LOCAL_PORT="5432"
LOCAL_USER="performance_user"
LOCAL_DB="performance_dashboard"
LOCAL_PASSWORD="local_dev_password"

# Temporary file for dump
DUMP_FILE="/tmp/prod_db_$(date +%Y%m%d_%H%M%S).sql"

echo "📋 Step 1: Checking local Docker containers..."
if ! docker ps | grep -q perf-dashboard-db-local; then
  echo "❌ Local PostgreSQL container is not running!"
  echo "   Run: docker-compose -f docker-compose.dev.yml up -d"
  exit 1
fi
echo "✅ Local PostgreSQL is running"
echo ""

echo "📦 Step 2: Exporting production database..."
docker exec -e PGPASSWORD="$PROD_PASSWORD" perf-dashboard-db-local \
  pg_dump \
    --host="$PROD_HOST" \
    --port="$PROD_PORT" \
    --username="$PROD_USER" \
    --dbname="$PROD_DB" \
    --clean \
    --if-exists \
    --no-owner \
    --no-acl \
    > "$DUMP_FILE"

LINE_COUNT=$(wc -l < "$DUMP_FILE")
echo "✅ Exported $LINE_COUNT lines to $DUMP_FILE"
echo ""

if [ "$LINE_COUNT" -lt 50 ]; then
  echo "⚠️  Warning: Dump file seems very small ($LINE_COUNT lines)"
  echo "   This might mean the production database is empty or there was an error."
  echo ""
  read -p "Do you want to continue? (y/n) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted"
    rm "$DUMP_FILE"
    exit 1
  fi
fi

echo "🗄️  Step 3: Importing to local database..."
echo "   This will DROP and recreate all tables in the local database."
read -p "Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Aborted"
  rm "$DUMP_FILE"
  exit 1
fi

# Import to local database
PGPASSWORD="$LOCAL_PASSWORD" psql \
  --host="$LOCAL_HOST" \
  --port="$LOCAL_PORT" \
  --username="$LOCAL_USER" \
  --dbname="$LOCAL_DB" \
  < "$DUMP_FILE"

echo "✅ Import complete!"
echo ""

echo "🧹 Step 4: Cleaning up..."
rm "$DUMP_FILE"
echo "✅ Temporary file removed"
echo ""

echo "📊 Step 5: Verifying data..."
TABLES=$(PGPASSWORD="$LOCAL_PASSWORD" psql \
  --host="$LOCAL_HOST" \
  --port="$LOCAL_PORT" \
  --username="$LOCAL_USER" \
  --dbname="$LOCAL_DB" \
  --tuples-only \
  --command="SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';")

TABLES=$(echo $TABLES | xargs)  # trim whitespace

echo "✅ Local database has $TABLES tables"
echo ""

if [ "$TABLES" -gt 0 ]; then
  echo "📈 Table summary:"
  PGPASSWORD="$LOCAL_PASSWORD" psql \
    --host="$LOCAL_HOST" \
    --port="$LOCAL_PORT" \
    --username="$LOCAL_USER" \
    --dbname="$LOCAL_DB" \
    --command="SELECT
      schemaname,
      tablename,
      COALESCE(n_tup_ins, 0) as rows
    FROM pg_stat_user_tables
    ORDER BY tablename;"
fi

echo ""
echo "✅ Production database successfully synced to local environment!"
echo ""
echo "💡 You can now:"
echo "   - View data: npx prisma studio"
echo "   - Start dev servers: npm run dev:both"
echo "   - Connect directly: psql -h localhost -U performance_user -d performance_dashboard"
echo ""