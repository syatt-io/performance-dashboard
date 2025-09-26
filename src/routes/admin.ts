import express, { Router } from 'express';
import { execSync } from 'child_process';

const router: Router = express.Router();

// One-time migration endpoint - REMOVE AFTER USE
router.post('/migrate-db-once', async (req, res) => {
  try {
    // Check for secret key
    const secretKey = req.headers['x-migration-key'];
    if (secretKey !== 'temp-migration-key-2024') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    console.log('Running database migrations...');
    const output = execSync('npx prisma migrate deploy', { encoding: 'utf-8' });
    console.log('Migration output:', output);

    res.json({
      success: true,
      message: 'Migrations completed successfully',
      output: output
    });
  } catch (error: any) {
    console.error('Migration error:', error.message);
    res.status(500).json({
      error: 'Migration failed',
      details: error.message,
      stdout: error.stdout?.toString(),
      stderr: error.stderr?.toString()
    });
  }
});

export default router;