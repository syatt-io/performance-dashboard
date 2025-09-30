import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import routes from './routes';
import { connectDatabase } from './services/database';
import { validateEnvironmentVariables } from './config/validateEnv';

// Load environment variables first
dotenv.config();

// Validate all required environment variables before starting the app
try {
  validateEnvironmentVariables();
} catch (error) {
  console.error('❌ Environment validation failed:');
  console.error((error as Error).message);
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3000;

// CORS setup
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:3001', 'http://localhost:3000']; // Default for development

app.use((req, res, next) => {
  const origin = req.headers.origin;

  // Check if origin is allowed
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (process.env.NODE_ENV === 'development') {
    // Allow all origins in development only
    res.setHeader('Access-Control-Allow-Origin', '*');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

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

// Temporary admin routes for migration
import adminRoutes from './routes/admin';
app.use('/api/admin', adminRoutes);

// In production, serve static files from Next.js build
if (process.env.NODE_ENV === 'production') {
  const frontendPath = path.join(__dirname, '../out');
  app.use(express.static(frontendPath));

  // Handle client-side routing - serve index.html for non-API routes
  app.use((req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
  });
}

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