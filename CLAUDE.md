# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a performance monitoring dashboard for Shopify e-commerce stores. The system tracks site speed metrics, Core Web Vitals, and Shopify-specific performance indicators to help improve conversion rates and user experience.

## Technology Stack

### Backend
- **Database**: PostgreSQL or TimescaleDB for time-series data
- **API Framework**: Node.js with Express or Fastify
- **Queue System**: Redis + Bull for scheduled monitoring jobs
- **Monitoring**: Puppeteer with Lighthouse API for synthetic monitoring

### Frontend
- **Framework**: React/Next.js
- **Visualization**: Recharts or Tremor for charts and dashboards
- **State Management**: To be determined based on complexity

## Common Development Commands

```bash
npm install            # Install dependencies
npm run dev            # Start API server only (port 3000)
npm run dev:frontend   # Start Next.js dashboard only (port 3001)
npm run dev:both       # Start both API and dashboard concurrently
npm run build          # Build TypeScript API to production
npm run build:frontend # Build Next.js dashboard
npm run start          # Start production API server
npm run start:frontend # Start production dashboard
npm run lint           # Run ESLint
npm run format         # Format code with Prettier
npm run prisma:generate # Generate Prisma client
npm run prisma:migrate  # Run database migrations

# Development URLs
API Server:     http://localhost:3000/api
Dashboard:      http://localhost:3001
Health Check:   http://localhost:3000/health

# Port Configuration
API Server (Backend): Port 3000
Dashboard (Frontend): Port 3001
Note: If port 3000 is occupied by another process, kill it first:
  lsof -i :3000  # Find process using port 3000
  kill <PID>     # Kill the conflicting process

# API Testing
curl http://localhost:3000/api/sites                           # List sites
curl -X POST http://localhost:3000/api/sites \                 # Create site
  -H "Content-Type: application/json" \
  -d '{"name":"Test Store","url":"https://test.myshopify.com"}'
curl -X POST http://localhost:3000/api/metrics/sites/{id}/collect  # Collect metrics
curl http://localhost:3000/api/metrics/sites/{id}/summary      # Get metrics summary
curl -X POST http://localhost:3000/api/metrics/cleanup-stuck-jobs # Clean up stuck monitoring jobs
```

## Architecture Overview

### Three-Tier Monitoring System
1. **Synthetic Monitoring**: Lighthouse API via Puppeteer for lab data (every 4-6 hours)
2. **Real User Monitoring (RUM)**: Shopify Web Performance API and custom JavaScript beacon
3. **Shopify-Specific Monitoring**: GraphQL Admin API, webhook listeners, Script Tag API

### Key Services
- **PerformanceCollector**: Runs Lighthouse tests and extracts Shopify metrics
- **RUM Service**: Collects real user Core Web Vitals data
- **Alert Service**: Monitors thresholds and sends notifications
- **Report Generator**: Creates automated client reports

### Data Flow
1. Scheduled jobs trigger performance collection
2. Metrics stored in TimescaleDB with appropriate retention policies
3. Alert service monitors for threshold violations
4. Dashboard aggregates and visualizes data
5. Weekly automated reports generated for clients

## Critical Metrics Tracked

### Core Web Vitals
- LCP (Largest Contentful Paint) - target: <2.5s
- FID (First Input Delay) - target: <100ms
- CLS (Cumulative Layout Shift) - target: <0.1
- INP (Interaction to Next Paint)

### Shopify-Specific Metrics
- Cart add-to-cart response time
- Checkout step completion times
- Third-party app performance impact
- Theme asset optimization
- Liquid render times

## API Integrations

### Shopify APIs
- GraphQL Admin API for store metrics
- Web Performance API for RUM data
- Script Tag API for app tracking
- Files API for image optimization

### External Services
- Lighthouse API for performance testing
- AWS Lambda@Edge for geographic testing
- Webhook endpoints for Shopify events

## Development Guidelines

### Database Migrations
- Use migrations for all schema changes
- TimescaleDB hypertables for metrics storage
- Appropriate retention policies for time-series data

### Testing Strategy
- Unit tests for metric calculations
- Integration tests for Shopify API interactions
- E2E tests for critical dashboard flows
- Mock Lighthouse data for consistent testing

### Performance Considerations
- Batch API calls to respect Shopify rate limits
- Use connection pooling for database
- Implement caching for dashboard queries
- Queue long-running Lighthouse tests

### Security
- Store Shopify API credentials in environment variables
- Implement API key rotation
- Use webhook verification for Shopify webhooks
- Sanitize all user inputs for dashboard filters
- never rever to using another API for performance testing without asking for approval
- for furure reference, build/deploy takes about 8 minutes