import { Router } from 'express';
import sitesRouter from './sites';
import metricsRouter from './metrics';
// import alertsRouter from './alerts'; // TODO: Re-enable when alerts table is created
import monitoringRouter from './monitoring';
import shopifyRouter from './shopify';
import insightsRouter from './insights';
import thirdPartyScriptsRouter from './thirdPartyScripts';
import { siteOperationsLimiter } from '../middleware/rateLimit';

const router = Router();

// Apply stricter rate limits to specific routes
router.use('/sites', siteOperationsLimiter, sitesRouter);
// Note: metrics router now handles its own rate limiting internally
// Read-only endpoints (job-status, summary) use apiLimiter
// Collection endpoints use metricsCollectionLimiter
router.use('/metrics', metricsRouter);
// router.use('/alerts', alertsRouter); // TODO: Re-enable when alerts table is created
router.use('/monitoring', monitoringRouter);
router.use('/shopify', shopifyRouter);
router.use('/insights', insightsRouter);
router.use('/third-party-scripts', thirdPartyScriptsRouter);

export default router;