import { prisma } from './database';
import { logger } from '../utils/logger';
import { detectScript, extractDomain, isThirdPartyScript } from '../lib/third-party-signatures';

export interface ThirdPartyScriptData {
  url: string;
  transferSize?: number;
  resourceSize?: number;
  startTime?: number;
  duration?: number;
  blockingTime?: number;
}

export interface NetworkRequest {
  url: string;
  resourceType?: string;
  transferSize?: number;
  resourceSize?: number;
  startTime?: number;
  duration?: number;
  mimeType?: string;
}

/**
 * Service for detecting and storing third-party scripts
 */
export class ThirdPartyScriptService {
  /**
   * Process and store third-party scripts detected from PageSpeed Insights audit
   */
  async processAndStoreScripts(
    siteId: string,
    siteUrl: string,
    auditDetails: any,
    metricId?: string,
    pageType: string = 'homepage',
    pageUrl: string = siteUrl,
    deviceType: 'mobile' | 'desktop' = 'mobile'
  ): Promise<void> {
    if (!auditDetails?.thirdParty || auditDetails.thirdParty.length === 0) {
      logger.info('No third-party scripts found in audit details');
      return;
    }

    logger.info(`🔍 Processing ${auditDetails.thirdParty.length} third-party scripts for site ${siteId}`);

    for (const tpItem of auditDetails.thirdParty) {
      try {
        // The entity might be a string or object, normalize it
        const entityName = typeof tpItem.entity === 'string' ? tpItem.entity : tpItem.entity?.text || 'Unknown';

        // Try to detect the script details from entity name
        // PageSpeed gives us entity names like "Google Analytics", "Facebook", etc.
        let vendor = entityName;
        let category = 'third-party';
        let isBlocking = false;

        // Use our signature database to enrich the data if we can find a matching URL
        // Note: PageSpeed Insights provides entity name, not individual URLs
        // We'll need to infer details from the entity name
        const detectionResult = this.detectFromEntityName(entityName);
        if (detectionResult.vendor) {
          vendor = detectionResult.vendor;
          category = detectionResult.category || 'third-party';
          isBlocking = detectionResult.isBlocking;
        }

        // Create a pseudo-URL from the entity name for tracking
        // Format: entity://entity-name
        const pseudoUrl = `entity://${entityName.toLowerCase().replace(/\s+/g, '-')}`;
        const domain = entityName.toLowerCase().replace(/\s+/g, '.');

        // Find or create the script record
        let script = await prisma.thirdPartyScript.findUnique({
          where: { url: pseudoUrl }
        });

        if (!script) {
          script = await prisma.thirdPartyScript.create({
            data: {
              url: pseudoUrl,
              domain: domain,
              vendor: vendor,
              category: category,
              isBlocking: isBlocking
            }
          });
          logger.info(`✅ Created new third-party script record: ${vendor} (${category})`);
        } else {
          // Update existing record if detection improved it
          if (vendor && vendor !== 'Unknown' && script.vendor !== vendor) {
            await prisma.thirdPartyScript.update({
              where: { id: script.id },
              data: {
                vendor: vendor,
                category: category,
                isBlocking: isBlocking
              }
            });
          }
        }

        // Create detection record
        await prisma.thirdPartyScriptDetection.create({
          data: {
            siteId: siteId,
            scriptId: script.id,
            metricId: metricId,
            pageType: pageType,
            pageUrl: pageUrl,
            deviceType: deviceType,
            transferSize: tpItem.transferSize ? tpItem.transferSize * 1024 : null, // Convert from KB to bytes
            blockingTime: tpItem.blockingTime || null
          }
        });

        logger.info(`📊 Recorded detection: ${vendor} - ${tpItem.transferSize}KB transfer, ${tpItem.blockingTime}ms blocking`);

      } catch (error) {
        logger.error(`❌ Failed to process third-party script:`, error);
      }
    }

    logger.info(`✅ Processed ${auditDetails.thirdParty.length} third-party scripts`);
  }

  /**
   * Process network requests and extract third-party scripts
   * This method is for when we have detailed network request data (e.g., from Puppeteer)
   */
  async processNetworkRequests(
    siteId: string,
    siteUrl: string,
    requests: NetworkRequest[],
    metricId?: string,
    pageType: string = 'homepage',
    pageUrl: string = siteUrl,
    deviceType: 'mobile' | 'desktop' = 'mobile'
  ): Promise<void> {
    logger.info(`🔍 Processing ${requests.length} network requests for third-party scripts`);

    // Filter for script resources that are third-party
    const scriptRequests = requests.filter(req => {
      const isScript = req.resourceType === 'script' ||
                      req.mimeType?.includes('javascript') ||
                      req.url.endsWith('.js');

      return isScript && isThirdPartyScript(req.url, siteUrl);
    });

    logger.info(`Found ${scriptRequests.length} third-party script requests`);

    for (const request of scriptRequests) {
      try {
        const domain = extractDomain(request.url);
        const detection = detectScript(request.url);

        // Find or create the script record
        let script = await prisma.thirdPartyScript.findUnique({
          where: { url: request.url }
        });

        if (!script) {
          script = await prisma.thirdPartyScript.create({
            data: {
              url: request.url,
              domain: domain,
              vendor: detection.vendor,
              category: detection.category,
              isBlocking: detection.isBlocking
            }
          });
          logger.info(`✅ Created new third-party script record: ${detection.vendor || domain} (${detection.category || 'unknown'})`);
        }

        // Create detection record
        await prisma.thirdPartyScriptDetection.create({
          data: {
            siteId: siteId,
            scriptId: script.id,
            metricId: metricId,
            pageType: pageType,
            pageUrl: pageUrl,
            deviceType: deviceType,
            transferSize: request.transferSize,
            resourceSize: request.resourceSize,
            startTime: request.startTime,
            duration: request.duration
          }
        });

        logger.info(`📊 Recorded detection: ${detection.vendor || domain}`);

      } catch (error) {
        logger.error(`❌ Failed to process network request for ${request.url}:`, error);
      }
    }

    logger.info(`✅ Processed ${scriptRequests.length} third-party scripts from network requests`);
  }

  /**
   * Get third-party scripts detected for a site
   */
  async getScriptsForSite(
    siteId: string,
    options?: {
      pageType?: string;
      deviceType?: string;
      timeRange?: { start: Date; end: Date };
    }
  ) {
    const where: any = { siteId };

    if (options?.pageType) {
      where.pageType = options.pageType;
    }

    if (options?.deviceType) {
      where.deviceType = options.deviceType;
    }

    if (options?.timeRange) {
      where.timestamp = {
        gte: options.timeRange.start,
        lte: options.timeRange.end
      };
    }

    const detections = await prisma.thirdPartyScriptDetection.findMany({
      where,
      include: {
        script: true
      },
      orderBy: {
        timestamp: 'desc'
      }
    });

    // Group by script and aggregate metrics
    const scriptMap = new Map<string, any>();

    for (const detection of detections) {
      const scriptId = detection.script.id;

      if (!scriptMap.has(scriptId)) {
        scriptMap.set(scriptId, {
          id: scriptId,
          url: detection.script.url,
          domain: detection.script.domain,
          vendor: detection.script.vendor,
          category: detection.script.category,
          isBlocking: detection.script.isBlocking,
          detectionCount: 0,
          totalTransferSize: 0,
          avgTransferSize: 0,
          totalBlockingTime: 0,
          avgBlockingTime: 0,
          lastSeen: detection.timestamp
        });
      }

      const script = scriptMap.get(scriptId);
      script.detectionCount++;
      if (detection.transferSize) script.totalTransferSize += detection.transferSize;
      if (detection.blockingTime) script.totalBlockingTime += detection.blockingTime;
      if (detection.timestamp > script.lastSeen) {
        script.lastSeen = detection.timestamp;
      }
    }

    // Calculate averages
    const scripts = Array.from(scriptMap.values()).map(script => ({
      ...script,
      avgTransferSize: script.totalTransferSize / script.detectionCount,
      avgBlockingTime: script.totalBlockingTime / script.detectionCount
    }));

    return scripts;
  }

  /**
   * Get summary statistics for third-party scripts on a site
   */
  async getSummaryForSite(siteId: string) {
    const scripts = await this.getScriptsForSite(siteId);

    const totalScripts = scripts.length;
    const totalTransferSize = scripts.reduce((sum, s) => sum + s.totalTransferSize, 0);
    const totalBlockingTime = scripts.reduce((sum, s) => sum + s.totalBlockingTime, 0);

    // Group by category
    const byCategory = scripts.reduce((acc, script) => {
      const cat = script.category || 'unknown';
      if (!acc[cat]) {
        acc[cat] = { count: 0, transferSize: 0, blockingTime: 0 };
      }
      acc[cat].count++;
      acc[cat].transferSize += script.avgTransferSize;
      acc[cat].blockingTime += script.avgBlockingTime;
      return acc;
    }, {} as Record<string, any>);

    return {
      totalScripts,
      totalTransferSize,
      totalBlockingTime,
      avgTransferSize: totalScripts > 0 ? totalTransferSize / totalScripts : 0,
      avgBlockingTime: totalScripts > 0 ? totalBlockingTime / totalScripts : 0,
      byCategory,
      scripts: scripts.sort((a, b) => b.avgBlockingTime - a.avgBlockingTime).slice(0, 10) // Top 10 by blocking time
    };
  }

  /**
   * Detect vendor/category from entity name
   * Helper for when we only have entity names (like from PageSpeed Insights)
   */
  private detectFromEntityName(entityName: string): {
    vendor: string | null;
    category: string | null;
    isBlocking: boolean;
  } {
    const lower = entityName.toLowerCase();

    // Map common entity names to our signature data
    const entityMap: Record<string, { vendor: string; category: string; isBlocking?: boolean }> = {
      'google analytics': { vendor: 'Google Analytics', category: 'analytics' },
      'google tag manager': { vendor: 'Google Tag Manager', category: 'analytics' },
      'google': { vendor: 'Google', category: 'analytics' },
      'facebook': { vendor: 'Facebook Pixel', category: 'analytics' },
      'meta': { vendor: 'Facebook Pixel', category: 'analytics' },
      'klaviyo': { vendor: 'Klaviyo', category: 'marketing' },
      'hotjar': { vendor: 'Hotjar', category: 'analytics' },
      'segment': { vendor: 'Segment', category: 'analytics' },
      'intercom': { vendor: 'Intercom', category: 'chat' },
      'zendesk': { vendor: 'Zendesk Chat', category: 'chat' },
      'gorgias': { vendor: 'Gorgias Chat', category: 'chat' },
      'yotpo': { vendor: 'Yotpo', category: 'reviews' },
      'judge.me': { vendor: 'Judge.me', category: 'reviews' },
      'privy': { vendor: 'Privy', category: 'marketing' },
      'optimizely': { vendor: 'Optimizely', category: 'optimization', isBlocking: true },
      'google optimize': { vendor: 'Google Optimize', category: 'optimization', isBlocking: true },
      'shopify': { vendor: 'Shopify', category: 'shopify-app' },
      'tiktok': { vendor: 'TikTok Pixel', category: 'analytics' },
      'pinterest': { vendor: 'Pinterest Tag', category: 'analytics' },
      'snapchat': { vendor: 'Snapchat Pixel', category: 'analytics' },
      'affirm': { vendor: 'Affirm', category: 'payments' },
      'afterpay': { vendor: 'Afterpay', category: 'payments' },
      'klarna': { vendor: 'Klarna', category: 'payments' },
      'sezzle': { vendor: 'Sezzle', category: 'payments' },
      'recaptcha': { vendor: 'reCAPTCHA', category: 'security' }
    };

    for (const [key, value] of Object.entries(entityMap)) {
      if (lower.includes(key)) {
        return {
          vendor: value.vendor,
          category: value.category,
          isBlocking: value.isBlocking || false
        };
      }
    }

    // If no match, return the entity name as vendor
    return {
      vendor: entityName,
      category: 'third-party',
      isBlocking: false
    };
  }
}

export const thirdPartyScriptService = new ThirdPartyScriptService();
