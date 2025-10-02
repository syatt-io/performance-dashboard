import axios from 'axios';
import * as cheerio from 'cheerio';
import { logger } from './logger';

/**
 * Discover a product URL from a Shopify site
 * Tries to find product links from the homepage or /collections/all page
 */
export async function discoverProductUrl(siteUrl: string): Promise<string | null> {
  try {
    // First, try to get products from /collections/all
    const collectionsUrl = `${siteUrl.replace(/\/$/, '')}/collections/all`;
    logger.info(`[Product Discovery] Attempting to discover product from ${collectionsUrl}`);

    const response = await axios.get(collectionsUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 10000,
      maxRedirects: 5
    });

    const $ = cheerio.load(response.data);

    // Look for common Shopify product link patterns
    const productSelectors = [
      'a[href*="/products/"]',
      '.product-card a[href*="/products/"]',
      '.product-item a[href*="/products/"]',
      '.product__link[href*="/products/"]',
      '[data-product-url]'
    ];

    for (const selector of productSelectors) {
      const productLinks = $(selector);
      if (productLinks.length > 0) {
        // Get the first product link
        let href = $(productLinks[0]).attr('href');

        if (href) {
          // Handle relative URLs
          if (href.startsWith('/')) {
            href = `${siteUrl.replace(/\/$/, '')}${href}`;
          }

          // Validate it's a product URL
          if (href.includes('/products/')) {
            logger.info(`[Product Discovery] Found product URL: ${href}`);
            return href;
          }
        }
      }
    }

    // If no product found in /collections/all, try the homepage
    logger.info(`[Product Discovery] No products found in /collections/all, trying homepage...`);
    const homepageResponse = await axios.get(siteUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 10000,
      maxRedirects: 5
    });

    const $homepage = cheerio.load(homepageResponse.data);

    for (const selector of productSelectors) {
      const productLinks = $homepage(selector);
      if (productLinks.length > 0) {
        let href = $homepage(productLinks[0]).attr('href');

        if (href) {
          if (href.startsWith('/')) {
            href = `${siteUrl.replace(/\/$/, '')}${href}`;
          }

          if (href.includes('/products/')) {
            logger.info(`[Product Discovery] Found product URL from homepage: ${href}`);
            return href;
          }
        }
      }
    }

    logger.warn(`[Product Discovery] No product URLs found for ${siteUrl}`);
    return null;

  } catch (error) {
    logger.error(`[Product Discovery] Failed to discover product URL for ${siteUrl}:`, error);
    return null;
  }
}
