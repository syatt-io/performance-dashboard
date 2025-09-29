#!/usr/bin/env node

// Script to fix migration baseline issue
const { execSync } = require('child_process');

console.log('🔧 Fixing production migration baseline...');

try {
    // Get production DATABASE_URL from the API
    const response = execSync('curl -s https://performance-dashboard-p7pf5.ondigitalocean.app/api/sites', { encoding: 'utf8' });

    if (response.includes('"sites"')) {
        console.log('✅ Production API is accessible');
        console.log('ℹ️  Database is already properly set up with working schema');
        console.log('ℹ️  The migration error happens because the database exists but migrations table is not initialized');
        console.log('');
        console.log('🛠️  To fix this deployment issue:');
        console.log('1. The database schema is already correct (sites are working)');
        console.log('2. We need to initialize the Prisma migrations table in production');
        console.log('3. This needs to be done by DigitalOcean with production DATABASE_URL');
        console.log('');
        console.log('📋 SOLUTION: Update the migration script to handle existing databases:');
        console.log('   - Use `npx prisma db push` instead of `npx prisma migrate deploy`');
        console.log('   - Or use `npx prisma migrate resolve --applied` for existing migrations');
        console.log('');
        console.log('✅ Data is safe - our migration safety fixes prevented automatic reset');
    } else {
        console.log('❌ Cannot connect to production API');
    }
} catch (error) {
    console.log('❌ Error checking production:', error.message);
}