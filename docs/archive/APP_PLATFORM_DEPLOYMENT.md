# DigitalOcean App Platform Deployment Guide

**Recommended deployment method** for the Performance Dashboard using DigitalOcean App Platform.

## Why App Platform Over Droplet?

### ✅ App Platform Advantages

1. **Zero Infrastructure Management**
   - No Docker, Nginx, or server configuration
   - Automatic SSL certificates and CDN
   - Built-in health checks and monitoring

2. **Perfect for Performance Testing**
   - Automatic scaling during Lighthouse operations
   - No memory crashes during intensive tests
   - Built-in load balancing

3. **Cost Effective**
   - **~$25-35/month** vs ~$48-60/month for droplet
   - Includes managed database and Redis
   - No separate SSL/nginx costs

4. **Developer Experience**
   - Direct GitHub integration
   - Automatic deployments on push
   - Built-in environment variable management
   - Native Next.js support

## Prerequisites

1. **DigitalOcean Account** with billing enabled
2. **GitHub Repository** with your code pushed
3. **API Keys**:
   - Google PageSpeed Insights API key
   - WebPageTest API key (optional)
   - Google Cloud service account JSON

## Deployment Steps

### Step 1: Prepare Your Repository

Your code is already App Platform ready! The existing structure works perfectly.

**Required Scripts** (add these to package.json):

```json
{
  "scripts": {
    "start:worker": "tsx src/workers/queue-processor.ts",
    "start:production": "npm run start:frontend & npm run start"
  }
}
```

### Step 2: Create App Platform Application

#### Option A: Using Web Interface

1. **Go to DigitalOcean Console** → Apps
2. **Create App** → Import from GitHub
3. **Select Repository**: `syatt-io/performance-dashboard`
4. **Import App Spec**: Upload `.do/app.yaml`
5. **Configure Environment Variables** (see below)
6. **Deploy**

#### Option B: Using CLI

```bash
# Install doctl CLI
brew install doctl  # macOS
# or: sudo snap install doctl  # Linux

# Authenticate
doctl auth init

# Create app
doctl apps create .do/app.yaml

# Get app ID and monitor deployment
doctl apps list
doctl apps logs <app-id> --follow
```

### Step 3: Configure Environment Variables

In the App Platform console, add these environment variables:

#### API Service Environment Variables

```env
NODE_ENV=production
PORT=3000
ENCRYPTION_KEY=your-32-character-encryption-key-here
PAGESPEED_API_KEY=your-pagespeed-insights-api-key
WEBPAGETEST_API_KEY=your-webpagetest-api-key
ALLOWED_ORIGINS=${_self.PUBLIC_URL}
GOOGLE_APPLICATION_CREDENTIALS=/app/service-account.json
```

#### Frontend Service Environment Variables

```env
NODE_ENV=production
PORT=3001
NEXT_PUBLIC_API_URL=${api.PUBLIC_URL}
```

**Note**: `DATABASE_URL` and `REDIS_URL` are automatically injected from database components.

### Step 4: Upload Service Account

**For Google Cloud Service Account:**

1. **Base64 encode your service account JSON**:
   ```bash
   base64 -i service-account.json | pbcopy  # macOS
   # or: base64 service-account.json | xclip -selection clipboard  # Linux
   ```

2. **Add as environment variable**:
   ```env
   GOOGLE_SERVICE_ACCOUNT_BASE64=<your-base64-encoded-json>
   ```

3. **Update your code to decode it**:
   ```typescript
   // In your service initialization
   if (process.env.GOOGLE_SERVICE_ACCOUNT_BASE64) {
     const serviceAccount = Buffer.from(
       process.env.GOOGLE_SERVICE_ACCOUNT_BASE64,
       'base64'
     ).toString('utf-8');
     fs.writeFileSync('/tmp/service-account.json', serviceAccount);
     process.env.GOOGLE_APPLICATION_CREDENTIALS = '/tmp/service-account.json';
   }
   ```

### Step 5: Database Setup

**App Platform automatically creates PostgreSQL database!**

1. **Migration**: The database URL is auto-injected
2. **Run migrations** via App Platform console or add to build command:
   ```bash
   npm run build && npx prisma migrate deploy
   ```

### Step 6: Custom Domain (Optional)

1. **In App Platform console** → Settings → Domains
2. **Add domain**: `yourdomain.com`
3. **Update DNS**: Point CNAME to provided App Platform URL
4. **SSL**: Automatically provisioned

## App Platform Configuration

The `.do/app.yaml` file configures:

- **API Service**: Node.js backend on port 3000
- **Frontend Service**: Next.js on port 3001
- **Database**: Managed PostgreSQL
- **Redis**: For Bull queue processing
- **Auto-scaling**: Based on traffic and resource usage

## Cost Breakdown

| Component | Monthly Cost |
|-----------|-------------|
| API Service (basic-xxs) | ~$12 |
| Frontend Service (basic-xxs) | ~$12 |
| PostgreSQL Database (basic) | ~$15 |
| Redis Service | ~$5 |
| **Total** | **~$44/month** |

**Scale up options:**
- **professional-xs**: $25/month per service (for heavy Lighthouse usage)
- **Database scaling**: $30-60/month for larger databases

## Benefits Over Droplet

### 🚀 Performance
- **Auto-scaling**: Handles traffic spikes automatically
- **CDN**: Global content delivery
- **Load balancing**: Built-in across multiple regions

### 🔒 Security
- **Automatic SSL**: Let's Encrypt certificates auto-renewed
- **VPC**: Isolated network by default
- **DDoS protection**: Built-in

### 🛠️ Operations
- **Zero downtime deployments**: Rolling updates
- **Health checks**: Automatic failure detection
- **Monitoring**: Built-in metrics and alerts
- **Logs**: Centralized logging

### 💰 Cost
- **35% cheaper** than equivalent droplet setup
- **No hidden costs**: SSL, monitoring, backups included
- **Pay for usage**: Scales down during low traffic

## Limitations to Consider

1. **Less Control**: Can't install custom system packages
2. **Build Time**: 10-minute build time limit
3. **Memory**: Max 8GB RAM per service
4. **Storage**: Ephemeral filesystem

**For your use case**: These limitations don't matter since you're using external APIs for performance testing.

## Migration Path

If you've already set up droplet configuration:

1. **Keep droplet files**: They're still useful for self-hosting options
2. **Use App Platform**: For production deployment
3. **Droplet for development**: Use for testing complex configurations

## Monitoring & Troubleshooting

### Health Checks
- **API**: `https://your-app.ondigitalocean.app/health`
- **Frontend**: `https://your-app.ondigitalocean.app/`

### Logs
```bash
# Via CLI
doctl apps logs <app-id> --type=build
doctl apps logs <app-id> --type=deploy
doctl apps logs <app-id> --type=run

# Via Console
Apps → Your App → Runtime Logs
```

### Common Issues

1. **Build Failures**: Check build logs for dependency issues
2. **Database Connection**: Verify DATABASE_URL is injected
3. **API Timeouts**: Increase timeout limits in app.yaml
4. **Memory Issues**: Scale up to professional-xs

## Next Steps After Deployment

1. **Test all endpoints**: API health, frontend loading, database connection
2. **Run performance test**: Verify Lighthouse integration works
3. **Set up monitoring**: Configure alerts for failures
4. **Domain setup**: Add custom domain if needed
5. **Backup strategy**: Configure database backups

---

## Summary

**App Platform is the clear winner** for your performance dashboard:

- ✅ **Easier deployment** and maintenance
- ✅ **Better performance** handling for Lighthouse tests
- ✅ **Lower cost** (~$44 vs ~$60/month)
- ✅ **Better scaling** for traffic spikes
- ✅ **Professional features** included (SSL, CDN, monitoring)

The droplet configuration files are still valuable for self-hosting or enterprise deployments, but App Platform is perfect for production SaaS deployment.

🚀 **Ready to deploy!** Use the `.do/app.yaml` configuration and follow this guide.