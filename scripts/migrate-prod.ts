import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function runMigrations() {
  if (process.env.NODE_ENV !== 'production') {
    console.log('[Migrate] Skipping migrations in non-production environment');
    return;
  }

  console.log('[Migrate] Checking for pending migrations...');

  try {
    // Run migrations
    const { stdout, stderr } = await execAsync('npx prisma migrate deploy');

    if (stdout) {
      console.log('[Migrate] Migration output:', stdout);
    }

    if (stderr) {
      console.error('[Migrate] Migration warnings:', stderr);
    }

    console.log('[Migrate] Migrations completed successfully');
  } catch (error: any) {
    console.error('[Migrate] Migration failed:', error.message);
    // Don't exit the process, allow the app to start anyway
    // The app might still work with some missing columns
  }
}

// Run migrations
runMigrations().catch(console.error);