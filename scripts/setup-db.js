#!/usr/bin/env node

const { execSync } = require('child_process');

console.log('Setting up database schema...');

try {
  // Run Prisma migrations
  console.log('Running Prisma migrations...');
  execSync('npx prisma migrate deploy', { stdio: 'inherit' });

  console.log('Database setup complete!');
  process.exit(0);
} catch (error) {
  console.error('Error setting up database:', error.message);
  process.exit(1);
}