# Local Development Environment

This guide shows how to set up a local development environment that mirrors the Digital Ocean production environment.

## Production Environment Details

**Digital Ocean Configuration:**
- **App Region**: Toronto (tor1)
- **Instance**: professional-xs (512MB RAM, 0.5 vCPU)
- **Database**: PostgreSQL 15 (db-s-1vcpu-1gb, 1GB RAM, 10GB disk, NYC1)
- **Redis**: Upstash Redis with TLS (rediss://)
- **Node.js**: Latest LTS

## Quick Setup

### Automated Setup (Recommended)

```bash
./scripts/setup-local-dev.sh
```

This script will:
1. Check if Docker is running
2. Create `.env.local` from template
3. Start PostgreSQL 15 and Redis 7 containers
4. Install npm dependencies
5. Generate Prisma client
6. Run database migrations

### Manual Setup

```bash
# 1. Start PostgreSQL and Redis
docker-compose -f docker-compose.dev.yml up -d

# 2. Create environment file
cp .env.local.example .env.local
# Edit .env.local with your API keys

# 3. Install dependencies
npm install

# 4. Generate Prisma client
npm run prisma:generate

# 5. Run migrations
npm run prisma:migrate:deploy

# 6. Start development servers
npm run dev:both
```

## Cloning Production Data (Optional)

To test with real production data locally:

### Option 1: Clone entire database

```bash
# Export from production
doctl databases backup list 8dbad607-69bb-4de4-a098-63b1cf557910

# Or create a fresh backup
doctl databases backup create 8dbad607-69bb-4de4-a098-63b1cf557910

# Download and restore locally
# (Digital Ocean doesn't provide direct backup downloads, so use pg_dump)
```

### Option 2: Export specific data

```bash
# Connect to production database
doctl databases connection-string 8dbad607-69bb-4de4-a098-63b1cf557910

# Export specific tables (sites and recent metrics)
pg_dump --host=<prod-host> \
        --username=<user> \
        --dbname=performance_dashboard \
        --table=sites \
        --table=performance_metrics \
        --data-only \
        --file=prod_data_export.sql

# Import to local database
psql -h localhost -U performance_user -d performance_dashboard < prod_data_export.sql
```

### Option 3: Populate with sample data (quickest)

```bash
# Run the sample data script (if available)
npm run seed:sample
```

## Environment Variables

| Variable | Production Value | Local Value | Notes |
|----------|-----------------|-------------|-------|
| `NODE_ENV` | `production` | `development` | Changes logging and error handling |
| `PORT` | `3000` | `3000` | Same port |
| `DATABASE_URL` | Managed DB | `postgresql://performance_user:local_dev_password@localhost:5432/performance_dashboard` | PostgreSQL 15 |
| `REDIS_URL` | Upstash (TLS) | `redis://localhost:6379` | Local Redis, no TLS |
| `ENCRYPTION_KEY` | 32-char secret | 32-char string | Generate random for local |
| `PAGESPEED_API_KEY` | Google API Key | Same | Use production key for accurate testing |
| `ALLOWED_ORIGINS` | Production URL | `http://localhost:3001,http://localhost:3000` | CORS settings |
| `NEXT_PUBLIC_API_URL` | Production URL | `http://localhost:3000` | Frontend API calls |

## Docker Services

### PostgreSQL 15
- **Image**: `postgres:15`
- **Port**: 5432
- **User**: `performance_user`
- **Password**: `local_dev_password`
- **Database**: `performance_dashboard`
- **Matches**: DO managed PostgreSQL 15 (db-s-1vcpu-1gb)

### Redis 7
- **Image**: `redis:7-alpine`
- **Port**: 6379
- **No password** (production uses Upstash with TLS)
- **Matches**: Redis functionality (not exact - Upstash uses rediss://)

## Useful Commands

### Docker Management
```bash
# Start containers
docker-compose -f docker-compose.dev.yml up -d

# Stop containers (keeps data)
docker-compose -f docker-compose.dev.yml down

# Stop and delete all data
docker-compose -f docker-compose.dev.yml down -v

# View logs
docker-compose -f docker-compose.dev.yml logs -f

# Access PostgreSQL shell
docker exec -it perf-dashboard-db-local psql -U performance_user -d performance_dashboard

# Access Redis CLI
docker exec -it perf-dashboard-redis-local redis-cli
```

### Database Management
```bash
# View database with Prisma Studio
npx prisma studio

# Create a new migration
npm run prisma:migrate:dev

# Deploy migrations (production-safe)
npm run prisma:migrate:deploy

# Reset database (delete all data)
npx prisma migrate reset
```

### Development Servers
```bash
# Start both API and dashboard
npm run dev:both

# Start API only
npm run dev

# Start dashboard only
npm run dev:frontend

# Build for production (test build process)
npm run build && npm run build:frontend
```

## Testing Changes Before Deployment

### 1. Test Database Migrations

```bash
# Create migration locally
npm run prisma:migrate:dev --name add_new_feature

# Test migration on fresh database
docker-compose -f docker-compose.dev.yml down -v
docker-compose -f docker-compose.dev.yml up -d
npm run prisma:migrate:deploy

# If successful, commit and push (DO will run migrations automatically)
```

### 2. Test Build Process

```bash
# Simulate production build (same command as DO)
npm ci && npx prisma migrate deploy && npm run build

# Test production mode locally
NODE_ENV=production npm run start
```

### 3. Test with Production Data

```bash
# Clone production data (see above)
# Then run your changes locally
npm run dev:both

# Verify functionality before deploying
```

## Differences from Production

| Aspect | Production | Local |
|--------|-----------|-------|
| Redis | Upstash with TLS (`rediss://`) | Local Redis (`redis://`) |
| Database Location | NYC1 data center | Local Docker |
| App Location | Toronto (tor1) | Your machine |
| HTTPS | Yes (automatic) | No (http only) |
| Memory | 512MB limit | No limit |
| CPU | 0.5 vCPU limit | No limit |
| Monitoring | Enabled | Disabled by default |

## Troubleshooting

### PostgreSQL Connection Issues

```bash
# Check if PostgreSQL is running
docker ps | grep perf-dashboard-db-local

# Check PostgreSQL logs
docker logs perf-dashboard-db-local

# Restart PostgreSQL
docker-compose -f docker-compose.dev.yml restart postgres
```

### Redis Connection Issues

```bash
# Check if Redis is running
docker ps | grep perf-dashboard-redis-local

# Test Redis connection
docker exec -it perf-dashboard-redis-local redis-cli ping

# Should return: PONG
```

### Port Conflicts

```bash
# Check what's using port 3000
lsof -i :3000

# Kill process
kill -9 <PID>

# Check PostgreSQL port
lsof -i :5432

# Check Redis port
lsof -i :6379
```

### Prisma Issues

```bash
# Regenerate Prisma client
npm run prisma:generate

# Reset Prisma client cache
rm -rf node_modules/.prisma
npm run prisma:generate

# Check database connection
npx prisma db pull
```

## Next Steps

After setup:
1. Access the dashboard at http://localhost:3001
2. API docs at http://localhost:3000/api
3. Health check at http://localhost:3000/health
4. Prisma Studio at http://localhost:5555 (run `npx prisma studio`)

## Deployment Checklist

Before deploying to production:
- [ ] Test database migrations locally
- [ ] Run build command successfully
- [ ] Test with production-like data
- [ ] Verify all environment variables are set
- [ ] Check that new code works with existing data
- [ ] Review logs for errors
- [ ] Test frontend and API integration