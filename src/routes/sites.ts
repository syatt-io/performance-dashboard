import { Router } from 'express';
import type { Request, Response } from 'express';
import { prisma } from '../services/database';
import { encryptCredentials, decryptCredentials } from '../utils/encryption';
import { validateSiteCreation, validateSiteUpdate, validateUuidParam } from '../middleware/validation';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const sites = await prisma.site.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            metrics: true,
            alerts: { where: { isResolved: false } }
          }
        }
      }
    });

    // Remove sensitive fields from response
    const sanitizedSites = sites.map(site => {
      const { apiKey, accessToken, ...safeSite } = site;
      return safeSite;
    });

    res.json({
      sites: sanitizedSites,
      total: sanitizedSites.length
    });
  } catch (error) {
    console.error('Error fetching sites:', error);
    res.status(500).json({ error: 'Failed to fetch sites' });
  }
});

router.post('/', validateSiteCreation, async (req: Request, res: Response) => {
  try {
    const { name, url, shopifyDomain, apiKey, accessToken } = req.body;

    if (!name || !url) {
      return res.status(400).json({ error: 'Name and URL are required' });
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    // Encrypt sensitive credentials before storing
    const encryptedCredentials = encryptCredentials({ apiKey, accessToken });

    const site = await prisma.site.create({
      data: {
        name,
        url,
        shopifyDomain,
        apiKey: encryptedCredentials.apiKey,
        accessToken: encryptedCredentials.accessToken,
      }
    });

    // Remove sensitive fields from response
    const { apiKey: _, accessToken: __, ...safeSite } = site;

    res.status(201).json(safeSite);
  } catch (error: any) {
    console.error('Error creating site:', error);
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
            metrics: true,
            alerts: { where: { isResolved: false } }
          }
        }
      }
    });

    if (!site) {
      return res.status(404).json({ error: 'Site not found' });
    }

    // Remove sensitive fields from response
    const { apiKey, accessToken, ...safeSite } = site;
    res.json(safeSite);
  } catch (error) {
    console.error('Error fetching site:', error);
    res.status(500).json({ error: 'Failed to fetch site' });
  }
});

router.put('/:id', validateUuidParam('id'), validateSiteUpdate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, url, shopifyDomain, isActive } = req.body;

    const site = await prisma.site.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(url && { url }),
        ...(shopifyDomain !== undefined && { shopifyDomain }),
        ...(isActive !== undefined && { isActive }),
      }
    });

    res.json(site);
  } catch (error: any) {
    console.error('Error updating site:', error);
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
    console.error('Error deleting site:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Site not found' });
    }
    res.status(500).json({ error: 'Failed to delete site' });
  }
});

export default router;