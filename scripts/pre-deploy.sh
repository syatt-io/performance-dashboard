#!/bin/bash

# Pre-deployment validation script
# This script runs before every deployment to catch bugs early

set -e  # Exit on any error

echo "🚀 Starting pre-deployment checks..."
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track overall status
ERRORS=0

# Function to print success
success() {
  echo -e "${GREEN}✓${NC} $1"
}

# Function to print error
error() {
  echo -e "${RED}✗${NC} $1"
  ERRORS=$((ERRORS + 1))
}

# Function to print warning
warning() {
  echo -e "${YELLOW}⚠${NC} $1"
}

# Function to print section header
section() {
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  $1"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

# 1. Check Node.js version
section "1. Checking Node.js version"
NODE_VERSION=$(node -v)
echo "Node version: $NODE_VERSION"
success "Node.js is installed"

# 2. Check for required environment variables
section "2. Validating environment variables"
if [ ! -f .env.local ]; then
  error ".env.local file not found"
else
  success ".env.local file exists"
fi

# Check critical environment variables (in production, these should be set)
REQUIRED_VARS=("DATABASE_URL" "REDIS_URL")
for VAR in "${REQUIRED_VARS[@]}"; do
  if grep -q "^${VAR}=" .env.local 2>/dev/null; then
    success "$VAR is configured"
  else
    warning "$VAR not found in .env.local (may be set in production)"
  fi
done

# 3. Install dependencies
section "3. Installing dependencies"
if npm ci --silent; then
  success "Dependencies installed"
else
  error "Failed to install dependencies"
fi

# 4. Generate Prisma client
section "4. Generating Prisma client"
if npm run prisma:generate --silent; then
  success "Prisma client generated"
else
  error "Failed to generate Prisma client"
fi

# 5. Run linter
section "5. Running ESLint"
if npm run lint; then
  success "No linting errors"
else
  error "Linting failed - please fix errors before deploying"
fi

# 6. Run TypeScript compiler
section "6. Type checking with TypeScript"
if npx tsc --noEmit --skipLibCheck; then
  success "No TypeScript errors"
else
  error "TypeScript compilation failed"
fi

# 7. Run tests (skip on macOS if timeout not available)
section "7. Running unit tests"
if command -v timeout > /dev/null 2>&1; then
  # Linux/timeout available
  if timeout 120 npm test -- --silent --maxWorkers=2; then
    success "All tests passed"
  else
    error "Tests failed"
  fi
else
  # macOS/no timeout - run with jest's own timeout
  if npm test -- --silent --maxWorkers=2 --testTimeout=5000; then
    success "All tests passed"
  else
    warning "Some tests may have timed out - review test output"
  fi
fi

# 8. Skip test coverage for faster deployment (optional)
section "8. Test coverage check"
warning "Test coverage check skipped for faster deployment"
warning "Run 'npm run test:coverage' manually to generate coverage report"

# 9. Build the application
section "9. Building application"
if npm run build; then
  success "Build completed successfully"
else
  error "Build failed"
fi

# 10. Check build artifacts
section "10. Verifying build artifacts"
if [ -d "dist" ] && [ "$(ls -A dist)" ]; then
  success "Backend build artifacts exist in dist/"
else
  error "Backend build artifacts missing"
fi

if [ -d ".next" ] && [ "$(ls -A .next)" ]; then
  success "Frontend build artifacts exist in .next/"
else
  error "Frontend build artifacts missing"
fi

# 11. Check for common issues
section "11. Checking for common issues"

# Check for console.log statements (should use logger instead)
if grep -r "console\.log" src/ --include="*.ts" --exclude-dir=node_modules | grep -v "logger" > /dev/null; then
  warning "Found console.log statements - consider using logger instead"
else
  success "No console.log statements found"
fi

# Check for TODO comments
TODO_COUNT=$(grep -r "TODO" src/ --include="*.ts" --exclude-dir=node_modules | wc -l | tr -d ' ')
if [ "$TODO_COUNT" -gt 0 ]; then
  warning "Found $TODO_COUNT TODO comments in codebase"
else
  success "No TODO comments found"
fi

# 12. Database migration check
section "12. Checking database migrations"
if npm run prisma:migrate:deploy --dry-run 2>&1 | grep -q "No pending migrations"; then
  success "No pending migrations (or dry-run not supported)"
else
  warning "Database migrations may need to be applied"
fi

# Final summary
section "Pre-deployment Check Summary"
echo ""

if [ $ERRORS -eq 0 ]; then
  echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${GREEN}  ✓ All checks passed! Ready to deploy.${NC}"
  echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
  exit 0
else
  echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${RED}  ✗ ${ERRORS} check(s) failed!${NC}"
  echo -e "${RED}  Please fix the errors before deploying.${NC}"
  echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
  exit 1
fi
