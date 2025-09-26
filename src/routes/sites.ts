import { Router } from 'express';
import type { Request, Response } from 'express';
import { prisma } from '../services/database';

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

    res.json({
      sites,
      total: sites.length
    });
  } catch (error) {
    console.error('Error fetching sites:', error);
    res.status(500).json({ error: 'Failed to fetch sites' });
  }
});

router.post('/', async (req: Request, res: Response) => {
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

    const site = await prisma.site.create({
      data: {
        name,
        url,
        shopifyDomain,
        apiKey, // Note: In production, these should be encrypted
        accessToken, // Note: In production, these should be encrypted
      }
    });

    res.status(201).json(site);
  } catch (error: any) {
    console.error('Error creating site:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Site with this URL already exists' });
    }
    res.status(500).json({ error: 'Failed to create site' });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
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

    res.json(site);
  } catch (error) {
    console.error('Error fetching site:', error);
    res.status(500).json({ error: 'Failed to fetch site' });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
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

router.delete('/:id', async (req: Request, res: Response) => {
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