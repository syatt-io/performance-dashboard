import {
  detectScript,
  extractDomain,
  isThirdPartyScript,
  THIRD_PARTY_SIGNATURES
} from '../../src/lib/third-party-signatures';

describe('third-party-signatures', () => {
  describe('detectScript', () => {
    it('should detect Google Analytics from domain', () => {
      const result = detectScript('https://www.google-analytics.com/analytics.js');
      expect(result.vendor).toBe('Google Analytics');
      expect(result.category).toBe('analytics');
      expect(result.isBlocking).toBe(false);
    });

    it('should detect Google Tag Manager', () => {
      const result = detectScript('https://www.googletagmanager.com/gtm.js?id=GTM-123');
      expect(result.vendor).toBe('Google Tag Manager');
      expect(result.category).toBe('analytics');
    });

    it('should detect Facebook Pixel', () => {
      const result = detectScript('https://connect.facebook.net/en_US/fbevents.js');
      expect(result.vendor).toBe('Facebook Pixel');
      expect(result.category).toBe('analytics');
    });

    it('should detect Klaviyo', () => {
      const result = detectScript('https://static.klaviyo.com/onsite/js/klaviyo.js');
      expect(result.vendor).toBe('Klaviyo');
      expect(result.category).toBe('marketing');
    });

    it('should detect Gorgias Chat', () => {
      const result = detectScript('https://config.gorgias.chat/loader.js');
      expect(result.vendor).toBe('Gorgias Chat');
      expect(result.category).toBe('chat');
    });

    it('should detect Yotpo', () => {
      const result = detectScript('https://staticw2.yotpo.com/widget.js');
      expect(result.vendor).toBe('Yotpo');
      expect(result.category).toBe('reviews');
    });

    it('should detect Optimizely as blocking', () => {
      const result = detectScript('https://cdn.optimizely.com/js/12345.js');
      expect(result.vendor).toBe('Optimizely');
      expect(result.category).toBe('optimization');
      expect(result.isBlocking).toBe(true);
    });

    it('should detect Affirm payment script', () => {
      const result = detectScript('https://cdn1.affirm.com/js/v2/affirm.js');
      expect(result.vendor).toBe('Affirm');
      expect(result.category).toBe('payments');
    });

    it('should detect Shopify apps', () => {
      const result = detectScript('https://cdn.shopifycdn.net/app_installations/123/widget.js');
      expect(result.vendor).toBe('Shopify App (Generic)');
      expect(result.category).toBe('shopify-app');
    });

    it('should return null values for unknown scripts', () => {
      const result = detectScript('https://unknown-domain.com/script.js');
      expect(result.vendor).toBeNull();
      expect(result.category).toBeNull();
      expect(result.isBlocking).toBe(false);
    });

    it('should handle case-insensitive matching', () => {
      const result = detectScript('https://WWW.GOOGLE-ANALYTICS.COM/analytics.js');
      expect(result.vendor).toBe('Google Analytics');
    });

    it('should not match when domain does not match but URL pattern does', () => {
      // This prevents false positives from generic URL patterns
      const result = detectScript('https://custom-cdn.com/gtag/js');
      expect(result.vendor).toBeNull();
    });
  });

  describe('extractDomain', () => {
    it('should extract domain from URL', () => {
      expect(extractDomain('https://www.google-analytics.com/analytics.js')).toBe('www.google-analytics.com');
    });

    it('should extract domain without protocol', () => {
      expect(extractDomain('http://example.com/path/to/script.js')).toBe('example.com');
    });

    it('should extract domain with subdomain', () => {
      expect(extractDomain('https://cdn.example.com/script.js')).toBe('cdn.example.com');
    });

    it('should handle URL with query parameters', () => {
      expect(extractDomain('https://example.com/script.js?version=1.0')).toBe('example.com');
    });

    it('should return unknown for invalid URLs', () => {
      expect(extractDomain('not-a-url')).toBe('unknown');
    });

    it('should handle localhost', () => {
      expect(extractDomain('http://localhost:3000/script.js')).toBe('localhost');
    });
  });

  describe('isThirdPartyScript', () => {
    it('should identify third-party script from different domain', () => {
      expect(isThirdPartyScript(
        'https://cdn.example.com/script.js',
        'https://mysite.com'
      )).toBe(true);
    });

    it('should identify first-party script from same domain', () => {
      expect(isThirdPartyScript(
        'https://mysite.com/assets/script.js',
        'https://mysite.com'
      )).toBe(false);
    });

    it('should handle www prefix correctly', () => {
      expect(isThirdPartyScript(
        'https://www.mysite.com/script.js',
        'https://mysite.com'
      )).toBe(false);
    });

    it('should handle www prefix in script URL', () => {
      expect(isThirdPartyScript(
        'https://mysite.com/script.js',
        'https://www.mysite.com'
      )).toBe(false);
    });

    it('should identify subdomain as third-party', () => {
      expect(isThirdPartyScript(
        'https://cdn.mysite.com/script.js',
        'https://mysite.com'
      )).toBe(true);
    });

    it('should handle invalid URLs gracefully', () => {
      expect(isThirdPartyScript('invalid-url', 'https://mysite.com')).toBe(false);
    });

    it('should identify different TLDs as third-party', () => {
      expect(isThirdPartyScript(
        'https://mysite.co.uk/script.js',
        'https://mysite.com'
      )).toBe(true);
    });
  });

  describe('THIRD_PARTY_SIGNATURES', () => {
    it('should contain valid signature objects', () => {
      THIRD_PARTY_SIGNATURES.forEach(signature => {
        expect(signature).toHaveProperty('vendor');
        expect(signature).toHaveProperty('category');
        expect(signature).toHaveProperty('patterns');
        expect(signature.vendor).toBeTruthy();
        expect(signature.category).toBeTruthy();
      });
    });

    it('should have patterns with domains or urlPatterns', () => {
      THIRD_PARTY_SIGNATURES.forEach(signature => {
        const hasPatterns =
          (signature.patterns.domains && signature.patterns.domains.length > 0) ||
          (signature.patterns.urlPatterns && signature.patterns.urlPatterns.length > 0);
        expect(hasPatterns).toBe(true);
      });
    });

    it('should have valid categories', () => {
      const validCategories = [
        'analytics', 'marketing', 'chat', 'reviews', 'payments',
        'shopify-app', 'personalization', 'loyalty', 'search',
        'social-proof', 'optimization', 'shipping', 'security'
      ];

      THIRD_PARTY_SIGNATURES.forEach(signature => {
        expect(validCategories).toContain(signature.category);
      });
    });

    it('should have unique vendor names', () => {
      const vendors = THIRD_PARTY_SIGNATURES.map(s => s.vendor);
      const uniqueVendors = new Set(vendors);
      expect(uniqueVendors.size).toBe(vendors.length);
    });

    it('should have isBlocking flag only when explicitly set', () => {
      const blockingSignatures = THIRD_PARTY_SIGNATURES.filter(s => s.isBlocking);
      // Optimization tools like Optimizely, VWO, Google Optimize should be blocking
      const hasOptimizationBlocking = blockingSignatures.some(s => s.category === 'optimization');
      expect(hasOptimizationBlocking).toBe(true);
    });
  });

  describe('Common third-party services detection', () => {
    const testCases = [
      { url: 'https://static.hotjar.com/c/hotjar-12345.js', expectedVendor: 'Hotjar' },
      { url: 'https://cdn.segment.com/analytics.js/v1/123/analytics.min.js', expectedVendor: 'Segment' },
      { url: 'https://widget.intercom.io/widget/abc123', expectedVendor: 'Intercom' },
      { url: 'https://cdn.judge.me/loader.js', expectedVendor: 'Judge.me' },
      { url: 'https://portal.afterpay.com/afterpay.js', expectedVendor: 'Afterpay' },
      { url: 'https://x.klarnacdn.net/kp/lib/v1/api.js', expectedVendor: 'Klarna' },
      { url: 'https://connect.nosto.com/script.js', expectedVendor: 'Nosto' },
      { url: 'https://cdn.smile.io/v1/smile-ui.js', expectedVendor: 'Smile.io' },
      { url: 'https://analytics.tiktok.com/i18n/pixel/events.js', expectedVendor: 'TikTok Pixel' },
      { url: 'https://s.pinimg.com/ct/core.js', expectedVendor: 'Pinterest Tag' },
    ];

    testCases.forEach(({ url, expectedVendor }) => {
      it(`should detect ${expectedVendor}`, () => {
        const result = detectScript(url);
        expect(result.vendor).toBe(expectedVendor);
      });
    });
  });
});
