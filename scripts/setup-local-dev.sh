#!/bin/bash
set -e

echo "🚀 Setting up local development environment..."
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
  echo "❌ Error: Docker is not running. Please start Docker Desktop."
  exit 1
fi

# Check if .env.local exists
if [ ! -f .env.local ]; then
  echo "📝 Creating .env.local from template..."
  cp .env.local.example .env.local
  echo "⚠️  Please edit .env.local and add your API keys before continuing."
  echo ""
  read -p "Press Enter when you've updated .env.local..."
fi

# Start PostgreSQL and Redis
echo ""
echo "🐳 Starting PostgreSQL and Redis containers..."
docker-compose -f docker-compose.dev.yml up -d

# Wait for PostgreSQL to be ready
echo ""
echo "⏳ Waiting for PostgreSQL to be ready..."
until docker exec perf-dashboard-db-local pg_isready -U performance_user -d performance_dashboard > /dev/null 2>&1; do
  echo -n "."
  sleep 1
done
echo " Ready!"

# Wait for Redis to be ready
echo ""
echo "⏳ Waiting for Redis to be ready..."
until docker exec perf-dashboard-redis-local redis-cli ping > /dev/null 2>&1; do
  echo -n "."
  sleep 1
done
echo " Ready!"

# Install dependencies
echo ""
echo "📦 Installing npm dependencies..."
npm install

# Generate Prisma client
echo ""
echo "🔧 Generating Prisma client..."
npm run prisma:generate

# Run migrations
echo ""
echo "🗄️  Running database migrations..."
npm run prisma:migrate:deploy

echo ""
echo "✅ Local development environment is ready!"
echo ""
echo "📌 Next steps:"
echo "   1. Start the development servers:"
echo "      npm run dev:both"
echo ""
echo "   2. Access the application:"
echo "      API: http://localhost:3000/api"
echo "      Dashboard: http://localhost:3001"
echo ""
echo "   3. View database:"
echo "      npx prisma studio"
echo ""
echo "💡 Useful commands:"
echo "   - View logs: docker-compose -f docker-compose.dev.yml logs -f"
echo "   - Stop containers: docker-compose -f docker-compose.dev.yml down"
echo "   - Reset database: docker-compose -f docker-compose.dev.yml down -v"
echo ""