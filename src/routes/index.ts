import { Router } from 'express';
import sitesRouter from './sites';
import metricsRouter from './metrics';
// import alertsRouter from './alerts'; // TODO: Re-enable when alerts table is created
import monitoringRouter from './monitoring';
import shopifyRouter from './shopify';
import { siteOperationsLimiter, metricsCollectionLimiter } from '../middleware/rateLimit';

const router = Router();

// Apply stricter rate limits to specific routes
router.use('/sites', siteOperationsLimiter, sitesRouter);
router.use('/metrics', metricsCollectionLimiter, metricsRouter);
// router.use('/alerts', alertsRouter); // TODO: Re-enable when alerts table is created
router.use('/monitoring', monitoringRouter);
router.use('/shopify', shopifyRouter);

export default router;