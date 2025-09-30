import { Router } from 'express';
import type { Request, Response } from 'express';
import { prisma } from '../services/database';
import { encryptCredentials, decryptCredentials } from '../utils/encryption';
import { validateSiteCreation, validateSiteUpdate, validateUuidParam } from '../middleware/validation';
import { logger } from '../utils/logger';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const sites = await prisma.site.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            metrics: true
          }
        }
      }
    });

    // Sites are already safe (no sensitive fields in current schema)
    const sanitizedSites = sites;

    res.json({
      sites: sanitizedSites,
      total: sanitizedSites.length
    });
  } catch (error) {
    logger.error('Error fetching sites', { error });
    res.status(500).json({ error: 'Failed to fetch sites' });
  }
});

router.post('/', validateSiteCreation, async (req: Request, res: Response) => {
  try {
    const { name, url, monitoringEnabled = true, checkFrequency = 360 } = req.body;

    if (!name || !url) {
      return res.status(400).json({ error: 'Name and URL are required' });
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    const site = await prisma.site.create({
      data: {
        name,
        url,
        monitoringEnabled,
        checkFrequency
      }
    });

    // Return the created site
    const safeSite = site;

    res.status(201).json(safeSite);
  } catch (error: any) {
    logger.error('Error creating site:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Site with this URL already exists' });
    }
    res.status(500).json({ error: 'Failed to create site' });
  }
});

router.get('/:id', validateUuidParam('id'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const site = await prisma.site.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            metrics: true
          }
        }
      }
    });

    if (!site) {
      return res.status(404).json({ error: 'Site not found' });
    }

    // Return site directly (no sensitive fields to remove)
    res.json(site);
  } catch (error) {
    logger.error('Error fetching site:', error);
    res.status(500).json({ error: 'Failed to fetch site' });
  }
});

router.put('/:id', validateUuidParam('id'), validateSiteUpdate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, url, monitoringEnabled, checkFrequency, isShopify } = req.body;

    const site = await prisma.site.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(url && { url }),
        ...(monitoringEnabled !== undefined && { monitoringEnabled }),
        ...(checkFrequency !== undefined && { checkFrequency }),
        ...(isShopify !== undefined && { isShopify }),
      }
    });

    res.json(site);
  } catch (error: any) {
    logger.error('Error updating site:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Site not found' });
    }
    res.status(500).json({ error: 'Failed to update site' });
  }
});

router.delete('/:id', validateUuidParam('id'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.site.delete({
      where: { id }
    });

    res.json({ message: 'Site deleted successfully' });
  } catch (error: any) {
    logger.error('Error deleting site:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Site not found' });
    }
    res.status(500).json({ error: 'Failed to delete site' });
  }
});

export default router;