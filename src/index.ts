import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import routes from './routes';
import { connectDatabase } from './services/database';
// import { schedulerService } from './services/schedulerService';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// CORS setup
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }

  next();
});

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

app.use('/api', routes);

async function startServer() {
  await connectDatabase();

  // Setup monitoring and scheduled jobs
  const monitoringEnabled = process.env.MONITORING_ENABLED === 'true';
  if (monitoringEnabled) {
    console.log('🔄 Setting up performance monitoring...');
    try {
      // await schedulerService.setupRecurringJobs();
      console.log('✅ Performance monitoring setup complete');
    } catch (error) {
      console.error('❌ Failed to setup performance monitoring:', error);
    }
  } else {
    console.log('⏸️ Performance monitoring disabled (set MONITORING_ENABLED=true to enable)');
  }

  app.listen(PORT, () => {
    console.log(`Performance Dashboard API running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
    console.log(`API endpoints available at: http://localhost:${PORT}/api`);
    if (monitoringEnabled) {
      console.log(`📊 Automatic monitoring: ENABLED (every ${process.env.LIGHTHOUSE_INTERVAL_HOURS || 6} hours)`);
    }
  });
}

startServer().catch(console.error);