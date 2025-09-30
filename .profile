# This file is sourced by Heroku buildpack before running the app
# Export all environment variables to ensure they're available to child processes
export REDIS_URL
export DATABASE_URL
export ENCRYPTION_KEY
export PAGESPEED_API_KEY
export ALLOWED_ORIGINS
export NEXT_PUBLIC_API_URL
export NODE_ENV
export PORT