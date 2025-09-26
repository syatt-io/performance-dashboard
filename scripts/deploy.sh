#!/bin/bash

# DigitalOcean Deployment Script
# Usage: ./scripts/deploy.sh

set -e

echo "🚀 Starting DigitalOcean deployment..."

# Configuration
DROPLET_IP="YOUR_DROPLET_IP"
DROPLET_USER="root"
APP_DIR="/opt/performance-dashboard"
REPO_URL="https://github.com/yourusername/performance-dashboard.git"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}"
    exit 1
}

success() {
    echo -e "${GREEN}[SUCCESS] $1${NC}"
}

# Check if required variables are set
if [ "$DROPLET_IP" = "YOUR_DROPLET_IP" ]; then
    error "Please set DROPLET_IP in the script"
fi

log "Connecting to DigitalOcean droplet at $DROPLET_IP..."

# Deploy to droplet
ssh -o StrictHostKeyChecking=no $DROPLET_USER@$DROPLET_IP << 'ENDSSH'
    set -e

    echo "📦 Updating system packages..."
    apt update && apt upgrade -y

    echo "🐳 Installing Docker and Docker Compose..."
    if ! command -v docker &> /dev/null; then
        curl -fsSL https://get.docker.com -o get-docker.sh
        sh get-docker.sh
        systemctl enable docker
        systemctl start docker
    fi

    if ! command -v docker-compose &> /dev/null; then
        curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
        chmod +x /usr/local/bin/docker-compose
    fi

    echo "📁 Setting up application directory..."
    mkdir -p /opt/performance-dashboard
    cd /opt/performance-dashboard

    echo "📥 Cloning/updating repository..."
    if [ -d ".git" ]; then
        git fetch origin
        git reset --hard origin/main
    else
        git clone https://github.com/yourusername/performance-dashboard.git .
    fi

    echo "🔧 Setting up environment..."
    if [ ! -f ".env.production" ]; then
        cp .env.production.example .env.production
        echo "⚠️  Please edit .env.production with your actual values"
    fi

    echo "🔨 Building and starting containers..."
    docker-compose down || true
    docker-compose build --no-cache
    docker-compose up -d

    echo "📊 Running database migrations..."
    docker-compose exec app npx prisma migrate deploy

    echo "🏥 Checking application health..."
    sleep 30
    if curl -f http://localhost:3000/health; then
        echo "✅ Application is healthy!"
    else
        echo "❌ Application health check failed"
        docker-compose logs app
    fi
ENDSSH

if [ $? -eq 0 ]; then
    success "Deployment completed successfully!"
    log "Your application should be available at http://$DROPLET_IP:3000"
    log "Frontend available at http://$DROPLET_IP:3001"
else
    error "Deployment failed!"
fi