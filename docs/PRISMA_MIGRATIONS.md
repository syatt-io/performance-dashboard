# Prisma Migrations Guide for Digital Ocean

## Overview

This document explains how Prisma migrations work in our Digital Ocean deployment and how to safely deploy schema changes to production.

## Key Concepts

### Migration Commands

1. **`prisma migrate dev`** - Development only
   - Creates new migrations
   - Applies pending migrations
   - Regenerates Prisma Client
   - ⚠️ **NEVER use in production**

2. **`prisma migrate deploy`** - Production safe
   - Only applies pending migrations
   - Does not create new migrations
   - Does not reset database
   - Safe for CI/CD pipelines

3. **`prisma generate`** - Generate Prisma Client
   - Updates TypeScript types
   - Must run after schema changes
   - Safe to run anywhere

## Our Digital Ocean Setup

### Build Process (runs on every deployment)

Digital Ocean runs these commands during build:

```bash
# package.json build script
npm run build

# Which runs:
prisma generate && tsc -p tsconfig.backend.json --skipLibCheck && cp -r src/generated dist/ && next build
```

### Migration Process

**Important**: Migrations are applied during the **run command**, NOT during build.

```bash
# package.json start script
npm run start

# Which runs:
npx prisma migrate deploy && node dist/index.js
```

This ensures:
1. Database is migrated before app starts
2. No migrations run during build (which uses build-time DATABASE_URL)
3. Migrations use runtime DATABASE_URL with proper credentials

## How to Deploy Schema Changes

### Step 1: Create Migration Locally

```bash
# Create migration without applying (to review SQL first)
npx prisma migrate dev --name descriptive_name --create-only

# Or create and apply immediately
npx prisma migrate dev --name descriptive_name
```

This creates a new migration file in `prisma/migrations/TIMESTAMP_descriptive_name/migration.sql`.

### Step 2: Review Generated SQL

Check the migration file to ensure it's correct:

```bash
cat prisma/migrations/TIMESTAMP_descriptive_name/migration.sql
```

Common things to verify:
- Index names are correct
- No accidental data loss (dropping columns)
- Foreign key constraints are as expected

### Step 3: Commit and Push

```bash
git add prisma/
git commit -m "feat: add performance indexes to metrics table"
git push origin main
```

### Step 4: Digital Ocean Auto-Deploy

Digital Ocean will:
1. Detect the push to main
2. Run build process (compiles code)
3. Run migrations via `npx prisma migrate deploy` in start command
4. Start the application

### Step 5: Monitor Deployment

```bash
# Watch logs in real-time
doctl apps logs 0a4c77ed-3edb-4ba3-a943-a73d9912be86 --type run --follow

# Check deployment status
doctl apps list
```

Look for:
- ✅ "Migration applied successfully"
- ✅ "Server started on port 8080"
- ❌ Any migration errors

## Common Issues & Solutions

### Issue 1: Migration Failed - Missing Environment Variable

**Error**: `Environment variable not found: ENCRYPTION_KEY`

**Solution**:
```bash
# Via dashboard: Settings → Environment Variables
# Or via CLI:
doctl apps update YOUR_APP_ID --env ENCRYPTION_KEY=your-32-char-key
```

### Issue 2: Migration Already Applied

**Symptom**: Deployment succeeds but migration doesn't run

**Cause**: Migration was already applied (this is normal on re-deploys)

**Solution**: No action needed - Prisma tracks applied migrations in `_prisma_migrations` table

### Issue 3: Schema Drift Detected

**Error**: "Database schema is not in sync with migration history"

**Cause**: Manual changes were made to production database

**Solution**:
```bash
# Option 1: Create migration from current state
npx prisma db pull  # Update schema.prisma from database
npx prisma migrate dev --name sync_manual_changes

# Option 2: Mark migration as applied (if you're certain it matches)
npx prisma migrate resolve --applied MIGRATION_NAME
```

### Issue 4: Build Fails - Prisma Generate Error

**Error**: "Can't reach database server"

**Cause**: Build tries to connect to database (shouldn't happen with our setup)

**Solution**: Ensure `prisma generate` doesn't require database connection
- Remove `--schema` flags that point to wrong location
- Ensure no preview features require database access

## Migration Best Practices

### ✅ DO

1. **Test locally first**
   ```bash
   # Start local Docker database
   docker-compose -f docker-compose.dev.yml up -d

   # Apply migration
   npx prisma migrate dev

   # Test the app
   npm run dev
   ```

2. **Use descriptive migration names**
   ```bash
   npx prisma migrate dev --name add_performance_indexes
   npx prisma migrate dev --name add_shopify_metrics_fields
   ```

3. **Review SQL before deploying**
   - Check for data loss (DROP COLUMN)
   - Verify index names
   - Ensure no blocking operations on large tables

4. **Commit migration files with code changes**
   - Migrations should be versioned with the code that uses them

5. **Use `--create-only` for complex migrations**
   ```bash
   npx prisma migrate dev --name complex_change --create-only
   # Edit migration.sql manually
   npx prisma migrate dev  # Apply the edited migration
   ```

### ❌ DON'T

1. **Never edit applied migrations**
   - Once deployed, migrations are immutable
   - Create a new migration instead

2. **Never use `prisma migrate deploy` locally**
   - Use `prisma migrate dev` for development
   - Only CI/CD should use `deploy`

3. **Never use `prisma migrate reset` in production**
   - This DROPS the entire database!
   - Only for development

4. **Never skip migrations**
   - Always apply in order
   - Don't delete old migrations

5. **Avoid large schema changes during peak hours**
   - Some migrations can lock tables
   - Schedule during low-traffic windows

## Rollback Procedure

### Option 1: Revert via Git (Recommended)

```bash
# Revert the commit that added the migration
git revert COMMIT_HASH
git push origin main

# Digital Ocean will redeploy
```

⚠️ **Warning**: This doesn't undo applied migrations! The schema change remains.

### Option 2: Create Down Migration (Manual)

```bash
# Generate SQL to revert the change
npx prisma migrate diff \
  --from-schema-datamodel prisma/schema.prisma \
  --to-schema-datasource prisma/schema.prisma \
  --script > down.sql

# Review down.sql, then apply manually if safe
psql $DATABASE_URL < down.sql
```

### Option 3: Mark as Rolled Back

```bash
# If migration failed and needs to be retried
npx prisma migrate resolve --rolled-back MIGRATION_NAME
```

## Monitoring Migration Status

### Check Applied Migrations

```bash
# Connect to production database
psql $DATABASE_URL

# Query migration history
SELECT * FROM _prisma_migrations ORDER BY finished_at DESC LIMIT 10;
```

### Check for Pending Migrations

```bash
# This command checks but doesn't apply
npx prisma migrate status
```

## Recent Changes (September 30, 2025)

### Security & Performance Fixes

1. **Removed hardcoded API key** (Critical)
   - Location: `src/services/lighthouse.ts:868`
   - Now requires `PAGESPEED_API_KEY` env var
   - Old key rotated: `AIzaSyClK7IglzS_ziiQl_CF3AMKenRhDPFq44c`
   - New key: `AIzaSyDly-tb56iIP72P-ba5lx6JXWf02w1zkQY`

2. **Added performance indexes**
   - Migration: `20250930133441_add_performance_indexes`
   - Indexes added:
     - `[siteId, deviceType, timestamp DESC]`
     - `[timestamp DESC]`
     - `[deviceType, timestamp DESC]`
     - `[pageType]`
   - Impact: Faster queries on large datasets

3. **Fixed encryption validation**
   - Now requires 32+ character `ENCRYPTION_KEY`
   - App fails fast if not set

4. **Added environment validation**
   - New file: `src/config/validateEnv.ts`
   - Validates required vars on startup

### Migration Applied Successfully ✅

Production database now has all performance indexes applied and is ready for improved query performance.

## Troubleshooting Checklist

Before deploying:
- [ ] Migration tested locally
- [ ] Migration SQL reviewed
- [ ] No data loss confirmed
- [ ] Environment variables set in production
- [ ] Backup created (if sensitive migration)
- [ ] Deployment logs monitored

After deploying:
- [ ] Migration applied successfully in logs
- [ ] Application started without errors
- [ ] API endpoints responding
- [ ] No error spike in monitoring
- [ ] Database queries performing as expected

## Contact

If you encounter issues with migrations, check:
1. Digital Ocean logs: `doctl apps logs <app-id> --type run`
2. Database connection: Verify `DATABASE_URL` in production env vars
3. Migration status: `npx prisma migrate status` (requires production DB access)

## References

- [Prisma Migrate Documentation](https://www.prisma.io/docs/orm/prisma-migrate)
- [Deploy Database Changes](https://www.prisma.io/docs/orm/prisma-client/deployment/deploy-database-changes-with-prisma-migrate)
- [Digital Ocean App Platform](https://docs.digitalocean.com/products/app-platform/)