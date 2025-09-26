import { Router } from 'express';
import sitesRouter from './sites';
import metricsRouter from './metrics';
import alertsRouter from './alerts';
import monitoringRouter from './monitoring';
import shopifyRouter from './shopify';

const router = Router();

router.use('/sites', sitesRouter);
router.use('/metrics', metricsRouter);
router.use('/alerts', alertsRouter);
router.use('/monitoring', monitoringRouter);
router.use('/shopify', shopifyRouter);

export default router;