# DigitalOcean Deployment Guide

This guide covers deploying the Performance Dashboard to DigitalOcean with PostgreSQL database.

## Prerequisites

### 1. DigitalOcean Account Setup

Create the following resources in DigitalOcean:

#### A. Droplet
- **Size**: Basic Regular (2GB RAM, 2 vCPUs) minimum
- **OS**: Ubuntu 22.04 LTS x64
- **Region**: Choose closest to your users
- **Additional Options**: Enable IPv6, Monitoring
- **SSH Keys**: Add your SSH public key

#### B. Managed PostgreSQL Database
- **Plan**: Basic (1GB RAM, 1 vCPU) minimum
- **Version**: PostgreSQL 15
- **Region**: Same as your droplet
- **Database Name**: `performance_dashboard`

#### C. Managed Redis (Optional but Recommended)
- **Plan**: Basic (1GB RAM)
- **Version**: Redis 7
- **Region**: Same as your droplet

#### D. Domain Setup
- Point your domain's A record to your droplet's IP
- For HTTPS: Set up DNS validation for Let's Encrypt

### 2. Local Setup

#### A. Clone Repository
```bash
git clone https://github.com/yourusername/performance-dashboard.git
cd performance-dashboard
```

#### B. Install Dependencies
```bash
npm install
```

#### C. Configure Environment
```bash
cp .env.production.example .env.production
```

Edit `.env.production` with your actual values:
- Update `DATABASE_URL` with your DigitalOcean PostgreSQL connection string
- Update `REDIS_URL` with your Redis connection string (if using managed Redis)
- Set `ALLOWED_ORIGINS` to your domain
- Add your API keys for PageSpeed Insights and WebPageTest
- Generate strong secrets for `ENCRYPTION_KEY` and `SESSION_SECRET`

## Deployment Steps

### Step 1: Prepare Database

1. **Test local connection to PostgreSQL:**
```bash
npx prisma db push --force-reset
npx prisma generate
```

2. **Run migrations:**
```bash
./scripts/migrate-db.sh
```

### Step 2: Upload Service Account

If using Google PageSpeed Insights API:

1. Download your Google Cloud service account JSON file
2. Upload it to your droplet:
```bash
scp service-account.json root@YOUR_DROPLET_IP:/opt/performance-dashboard/
```

### Step 3: Deploy Application

1. **Update deployment script:**
   - Edit `scripts/deploy.sh`
   - Replace `YOUR_DROPLET_IP` with your actual droplet IP
   - Update the repository URL

2. **Run deployment:**
```bash
./scripts/deploy.sh
```

### Step 4: Configure SSL (Production)

#### Option A: Let's Encrypt with Certbot

SSH into your droplet and run:

```bash
# Install certbot
apt install certbot python3-certbot-nginx

# Get SSL certificate
certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Auto-renewal (add to crontab)
echo "0 12 * * * /usr/bin/certbot renew --quiet" | crontab -
```

#### Option B: DigitalOcean Load Balancer

1. Create a Load Balancer in DigitalOcean
2. Add SSL certificate through DO interface
3. Point Load Balancer to your droplet on port 80
4. Update nginx config to handle forwarded headers

### Step 5: Configure Monitoring

#### A. Enable DigitalOcean Monitoring

```bash
# Install DO agent
curl -sSL https://repos.insights.digitalocean.com/install.sh | sudo bash
```

#### B. Set up Log Rotation

```bash
# Create logrotate config
cat > /etc/logrotate.d/performance-dashboard << EOF
/var/log/performance-dashboard/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 644 nextjs nextjs
}
EOF
```

### Step 6: Performance Optimization

#### A. Enable Swap (for low memory droplets)

```bash
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' | tee -a /etc/fstab
```

#### B. Configure Firewall

```bash
ufw allow ssh
ufw allow http
ufw allow https
ufw --force enable
```

## Maintenance

### Updating the Application

```bash
# SSH into droplet
ssh root@YOUR_DROPLET_IP

# Navigate to app directory
cd /opt/performance-dashboard

# Pull latest changes
git pull origin main

# Rebuild and restart
docker-compose down
docker-compose build --no-cache
docker-compose up -d

# Run any new migrations
docker-compose exec app npx prisma migrate deploy
```

### Database Backups

Set up automated backups in DigitalOcean:

1. Go to Databases → Your PostgreSQL cluster
2. Enable "Automatic Backups"
3. Set retention period (7-30 days)

### Monitoring

#### Health Checks
- Application: `https://yourdomain.com/health`
- Database: Check DigitalOcean database metrics
- Redis: Check DigitalOcean Redis metrics

#### Logs
```bash
# Application logs
docker-compose logs app

# Nginx logs
docker-compose logs nginx

# Database logs (in DO console)
```

### Scaling

#### Vertical Scaling (Resize Droplet)
1. Power off droplet in DO console
2. Resize to larger plan
3. Power on and verify application

#### Database Scaling
1. Resize PostgreSQL cluster in DO console
2. No application changes needed

## Troubleshooting

### Common Issues

#### 1. Database Connection Failed
- Check DATABASE_URL in .env.production
- Verify firewall allows connections from droplet
- Check DigitalOcean database trust sources

#### 2. Lighthouse/Puppeteer Issues
- Ensure Chrome dependencies are installed (handled by Dockerfile)
- Check memory usage (Lighthouse is memory-intensive)
- Verify no-sandbox flags in production

#### 3. Performance Issues
- Check droplet resources (CPU, RAM, disk)
- Monitor database performance in DO console
- Enable Redis for queue management

#### 4. SSL Issues
- Verify domain DNS points to droplet
- Check nginx SSL configuration
- Ensure ports 80 and 443 are open

### Support

For deployment issues:
1. Check logs: `docker-compose logs`
2. Verify health endpoint: `curl http://localhost:3000/health`
3. Check database connectivity: `npx prisma db push`

## Security Checklist

- [ ] Strong passwords for all services
- [ ] SSH key authentication (disable password auth)
- [ ] Firewall configured (ufw)
- [ ] SSL/TLS enabled
- [ ] Regular security updates
- [ ] Environment variables secured
- [ ] Database access restricted
- [ ] Application logs monitored

## Cost Optimization

### Estimated Monthly Costs (USD)

| Resource | Basic | Recommended |
|----------|-------|------------|
| Droplet (2GB) | $18 | $18 |
| PostgreSQL | $15 | $15 |
| Redis | $15 | $15 |
| Load Balancer | - | $12 |
| **Total** | **$48** | **$60** |

### Cost Reduction Tips

1. **Self-hosted Redis**: Run Redis on droplet instead of managed service (-$15/month)
2. **Smaller database**: Use shared CPU database for development (-$5/month)
3. **Reserved instances**: Use reserved pricing for 12+ month commitments (20% discount)
4. **Monitoring**: Set up billing alerts to avoid overage charges

## Next Steps

After successful deployment:

1. **Setup monitoring alerts** for application health
2. **Configure backup strategy** for critical data
3. **Implement CI/CD pipeline** for automated deployments
4. **Performance testing** under load
5. **Documentation** for your team

---

🎉 **Congratulations!** Your Performance Dashboard is now running on DigitalOcean.

For questions or issues, check the troubleshooting section above or create an issue in the repository.