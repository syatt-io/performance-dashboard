/**
 * Third-Party Script Detection Signatures
 *
 * Database of known third-party services and their detection patterns.
 * Organized by category for easier management and reporting.
 */

export interface ScriptSignature {
  vendor: string;
  category: string;
  patterns: {
    domains?: string[];
    urlPatterns?: RegExp[];
    scriptPatterns?: RegExp[]; // For content-based detection
  };
  isBlocking?: boolean; // Whether the script typically blocks rendering
}

export const THIRD_PARTY_SIGNATURES: ScriptSignature[] = [
  // ===== ANALYTICS =====
  {
    vendor: 'Google Tag Manager',
    category: 'analytics',
    patterns: {
      domains: ['googletagmanager.com'],
      urlPatterns: [/gtm\.js/],
    },
  },
  {
    vendor: 'Google Analytics',
    category: 'analytics',
    patterns: {
      domains: ['google-analytics.com'],
      urlPatterns: [/gtag\/js/, /analytics\.js/, /ga\.js/],
    },
  },
  {
    vendor: 'Facebook Pixel',
    category: 'analytics',
    patterns: {
      domains: ['connect.facebook.net'],
      urlPatterns: [/fbevents\.js/],
    },
  },
  {
    vendor: 'Hotjar',
    category: 'analytics',
    patterns: {
      domains: ['static.hotjar.com'],
      urlPatterns: [/hotjar.*\.js/],
    },
  },
  {
    vendor: 'Segment',
    category: 'analytics',
    patterns: {
      domains: ['cdn.segment.com'],
      urlPatterns: [/analytics\.js/],
    },
  },
  {
    vendor: 'Mixpanel',
    category: 'analytics',
    patterns: {
      domains: ['cdn.mxpnl.com'],
      urlPatterns: [/mixpanel.*\.js/],
    },
  },
  {
    vendor: 'TikTok Pixel',
    category: 'analytics',
    patterns: {
      domains: ['analytics.tiktok.com'],
      urlPatterns: [/pixel\/events\.js/],
    },
  },
  {
    vendor: 'Pinterest Tag',
    category: 'analytics',
    patterns: {
      domains: ['s.pinimg.com'],
      urlPatterns: [/pintrk\.js/],
    },
  },
  {
    vendor: 'Snapchat Pixel',
    category: 'analytics',
    patterns: {
      domains: ['sc-static.net'],
      urlPatterns: [/pixel\.js/],
    },
  },

  // ===== MARKETING & EMAIL =====
  {
    vendor: 'Klaviyo',
    category: 'marketing',
    patterns: {
      domains: ['static.klaviyo.com'],
      urlPatterns: [/klaviyo.*\.js/],
    },
  },
  {
    vendor: 'Mailchimp',
    category: 'marketing',
    patterns: {
      domains: ['chimpstatic.com'],
      urlPatterns: [/mcjs\.js/],
    },
  },
  {
    vendor: 'Privy',
    category: 'marketing',
    patterns: {
      domains: ['privy.com'],
      urlPatterns: [/widget\.js/],
    },
  },
  {
    vendor: 'OptinMonster',
    category: 'marketing',
    patterns: {
      domains: ['a.omappapi.com'],
      urlPatterns: [/omapp\.js/],
    },
  },
  {
    vendor: 'Justuno',
    category: 'marketing',
    patterns: {
      domains: ['cdn.justuno.com'],
      urlPatterns: [/juno.*\.js/],
    },
  },

  // ===== CHAT & SUPPORT =====
  {
    vendor: 'Gorgias Chat',
    category: 'chat',
    patterns: {
      domains: ['config.gorgias.chat'],
      urlPatterns: [/gorgias-chat.*\.js/],
    },
  },
  {
    vendor: 'Zendesk Chat',
    category: 'chat',
    patterns: {
      domains: ['static.zdassets.com'],
      urlPatterns: [/chat.*\.js/, /zendesk.*\.js/],
    },
  },
  {
    vendor: 'Intercom',
    category: 'chat',
    patterns: {
      domains: ['widget.intercom.io'],
      urlPatterns: [/intercom.*\.js/],
    },
  },
  {
    vendor: 'Tidio',
    category: 'chat',
    patterns: {
      domains: ['code.tidio.co'],
      urlPatterns: [/tidio.*\.js/],
    },
  },
  {
    vendor: 'Drift',
    category: 'chat',
    patterns: {
      domains: ['js.driftt.com'],
      urlPatterns: [/drift.*\.js/],
    },
  },
  {
    vendor: 'LiveChat',
    category: 'chat',
    patterns: {
      domains: ['cdn.livechatinc.com'],
      urlPatterns: [/livechat.*\.js/],
    },
  },

  // ===== REVIEWS & RATINGS =====
  {
    vendor: 'Yotpo',
    category: 'reviews',
    patterns: {
      domains: ['staticw2.yotpo.com'],
      urlPatterns: [/yotpo.*\.js/],
    },
  },
  {
    vendor: 'Judge.me',
    category: 'reviews',
    patterns: {
      domains: ['cdn.judge.me'],
      urlPatterns: [/judge.*\.js/],
    },
  },
  {
    vendor: 'Loox',
    category: 'reviews',
    patterns: {
      domains: ['loox.io'],
      urlPatterns: [/loox.*\.js/],
    },
  },
  {
    vendor: 'Stamped.io',
    category: 'reviews',
    patterns: {
      domains: ['cdn1.stamped.io'],
      urlPatterns: [/stamped.*\.js/],
    },
  },

  // ===== PAYMENTS & CHECKOUT =====
  {
    vendor: 'Affirm',
    category: 'payments',
    patterns: {
      domains: ['cdn1.affirm.com'],
      urlPatterns: [/affirm.*\.js/],
    },
  },
  {
    vendor: 'Afterpay',
    category: 'payments',
    patterns: {
      domains: ['portal.afterpay.com'],
      urlPatterns: [/afterpay.*\.js/],
    },
  },
  {
    vendor: 'Klarna',
    category: 'payments',
    patterns: {
      domains: ['x.klarnacdn.net'],
      urlPatterns: [/klarna.*\.js/],
    },
  },
  {
    vendor: 'Sezzle',
    category: 'payments',
    patterns: {
      domains: ['widget.sezzle.com'],
      urlPatterns: [/sezzle.*\.js/],
    },
  },
  {
    vendor: 'Shop Pay',
    category: 'payments',
    patterns: {
      domains: ['cdn.shopify.com'],
      urlPatterns: [/shop_pay.*\.js/, /shopify-pay.*\.js/],
    },
  },

  // ===== SHOPIFY APPS (Common CDN patterns) =====
  {
    vendor: 'Shopify App (Generic)',
    category: 'shopify-app',
    patterns: {
      domains: ['cdn.shopifycdn.net'],
      urlPatterns: [/shopifycloud\.com/, /app_installations/],
    },
  },

  // ===== PERSONALIZATION & RECOMMENDATIONS =====
  {
    vendor: 'Nosto',
    category: 'personalization',
    patterns: {
      domains: ['connect.nosto.com'],
      urlPatterns: [/nosto.*\.js/],
    },
  },
  {
    vendor: 'LimeSpot',
    category: 'personalization',
    patterns: {
      domains: ['cdn.limespot.com'],
      urlPatterns: [/limespot.*\.js/],
    },
  },
  {
    vendor: 'Rebuy',
    category: 'personalization',
    patterns: {
      domains: ['cdn.rebuyengine.com'],
      urlPatterns: [/rebuy.*\.js/],
    },
  },

  // ===== LOYALTY & REWARDS =====
  {
    vendor: 'Smile.io',
    category: 'loyalty',
    patterns: {
      domains: ['cdn.smile.io'],
      urlPatterns: [/smile.*\.js/],
    },
  },
  {
    vendor: 'Yotpo Loyalty',
    category: 'loyalty',
    patterns: {
      domains: ['cdn-loyalty.yotpo.com'],
      urlPatterns: [/swell.*\.js/],
    },
  },
  {
    vendor: 'LoyaltyLion',
    category: 'loyalty',
    patterns: {
      domains: ['sdk.loyaltylion.net'],
      urlPatterns: [/loyaltylion.*\.js/],
    },
  },

  // ===== SEARCH =====
  {
    vendor: 'Algolia',
    category: 'search',
    patterns: {
      domains: ['cdn.jsdelivr.net'],
      urlPatterns: [/algoliasearch.*\.js/, /autocomplete.*\.js/],
    },
  },
  {
    vendor: 'Searchanise',
    category: 'search',
    patterns: {
      domains: ['searchanise.com'],
      urlPatterns: [/searchanise.*\.js/],
    },
  },

  // ===== SOCIAL PROOF & URGENCY =====
  {
    vendor: 'Fomo',
    category: 'social-proof',
    patterns: {
      domains: ['load.fomo.com'],
      urlPatterns: [/fomo.*\.js/],
    },
  },
  {
    vendor: 'Vitals (Social Proof)',
    category: 'social-proof',
    patterns: {
      domains: ['cdn.vitals.app'],
      urlPatterns: [/vitals.*\.js/],
    },
  },
  {
    vendor: 'Fera',
    category: 'social-proof',
    patterns: {
      domains: ['cdn.fera.ai'],
      urlPatterns: [/fera.*\.js/],
    },
  },

  // ===== A/B TESTING & OPTIMIZATION =====
  {
    vendor: 'Optimizely',
    category: 'optimization',
    patterns: {
      domains: ['cdn.optimizely.com'],
      urlPatterns: [/optimizely.*\.js/],
    },
    isBlocking: true, // Often blocks to prevent flicker
  },
  {
    vendor: 'VWO',
    category: 'optimization',
    patterns: {
      domains: ['dev.visualwebsiteoptimizer.com'],
      urlPatterns: [/vwo.*\.js/],
    },
    isBlocking: true,
  },
  {
    vendor: 'Google Optimize',
    category: 'optimization',
    patterns: {
      domains: ['www.googleoptimize.com'],
      urlPatterns: [/optimize.*\.js/],
    },
    isBlocking: true,
  },

  // ===== SHIPPING & DELIVERY =====
  {
    vendor: 'ShipStation',
    category: 'shipping',
    patterns: {
      domains: ['cdn.shipstation.com'],
      urlPatterns: [/shipstation.*\.js/],
    },
  },
  {
    vendor: 'Route',
    category: 'shipping',
    patterns: {
      domains: ['cdn.routeapp.io'],
      urlPatterns: [/route.*\.js/],
    },
  },

  // ===== OTHER COMMON SERVICES =====
  {
    vendor: 'Trustpilot',
    category: 'reviews',
    patterns: {
      domains: ['widget.trustpilot.com'],
      urlPatterns: [/trustpilot.*\.js/],
    },
  },
  {
    vendor: 'reCAPTCHA',
    category: 'security',
    patterns: {
      domains: ['www.google.com'],
      urlPatterns: [/recaptcha.*\.js/],
    },
  },

  // ===== ADDITIONAL ANALYTICS =====
  {
    vendor: 'Amplitude',
    category: 'analytics',
    patterns: {
      domains: ['cdn.amplitude.com'],
      urlPatterns: [/amplitude.*\.js/],
    },
  },
  {
    vendor: 'Heap Analytics',
    category: 'analytics',
    patterns: {
      domains: ['cdn.heapanalytics.com'],
      urlPatterns: [/heap.*\.js/],
    },
  },
  {
    vendor: 'Pendo',
    category: 'analytics',
    patterns: {
      domains: ['cdn.pendo.io'],
      urlPatterns: [/pendo.*\.js/],
    },
  },
  {
    vendor: 'FullStory',
    category: 'analytics',
    patterns: {
      domains: ['fullstory.com'],
      urlPatterns: [/fullstory.*\.js/, /fs\.js/],
    },
  },
  {
    vendor: 'LogRocket',
    category: 'analytics',
    patterns: {
      domains: ['cdn.logrocket.io'],
      urlPatterns: [/logrocket.*\.js/],
    },
  },
  {
    vendor: 'Sentry',
    category: 'monitoring',
    patterns: {
      domains: ['browser.sentry-cdn.com'],
      urlPatterns: [/sentry.*\.js/],
    },
  },

  // ===== ADDITIONAL PAYMENTS =====
  {
    vendor: 'PayPal',
    category: 'payments',
    patterns: {
      domains: ['www.paypal.com', 'www.paypalobjects.com'],
      urlPatterns: [/paypal.*\.js/],
    },
  },
  {
    vendor: 'Stripe',
    category: 'payments',
    patterns: {
      domains: ['js.stripe.com'],
      urlPatterns: [/stripe.*\.js/],
    },
  },
  {
    vendor: 'Apple Pay',
    category: 'payments',
    patterns: {
      domains: ['applepay.cdn-apple.com'],
      urlPatterns: [/applepay.*\.js/],
    },
  },
  {
    vendor: 'Braintree',
    category: 'payments',
    patterns: {
      domains: ['js.braintreegateway.com'],
      urlPatterns: [/braintree.*\.js/],
    },
  },
  {
    vendor: 'Square',
    category: 'payments',
    patterns: {
      domains: ['js.squareup.com'],
      urlPatterns: [/square.*\.js/],
    },
  },

  // ===== SMS & SUBSCRIPTION =====
  {
    vendor: 'Attentive',
    category: 'marketing',
    patterns: {
      domains: ['cdn.attn.tv'],
      urlPatterns: [/attentive.*\.js/],
    },
  },
  {
    vendor: 'Postscript',
    category: 'marketing',
    patterns: {
      domains: ['sdk.postscript.io'],
      urlPatterns: [/postscript.*\.js/],
    },
  },

  // ===== ADDITIONAL A/B TESTING =====
  {
    vendor: 'Convert',
    category: 'optimization',
    patterns: {
      domains: ['cdn-3.convertexperiments.com'],
      urlPatterns: [/convert.*\.js/],
    },
    isBlocking: true,
  },
  {
    vendor: 'AB Tasty',
    category: 'optimization',
    patterns: {
      domains: ['try.abtasty.com'],
      urlPatterns: [/abtasty.*\.js/],
    },
    isBlocking: true,
  },
  {
    vendor: 'Kameleoon',
    category: 'optimization',
    patterns: {
      domains: ['cdn.kameleoon.com'],
      urlPatterns: [/kameleoon.*\.js/],
    },
    isBlocking: true,
  },

  // ===== CDN & PERFORMANCE =====
  {
    vendor: 'Cloudflare',
    category: 'cdn',
    patterns: {
      domains: ['cdnjs.cloudflare.com'],
      urlPatterns: [/cloudflare.*\.js/],
    },
  },
  {
    vendor: 'Fastly',
    category: 'cdn',
    patterns: {
      domains: ['fastly.net'],
      urlPatterns: [/fastly.*\.js/],
    },
  },

  // ===== VIDEO & MEDIA =====
  {
    vendor: 'YouTube',
    category: 'media',
    patterns: {
      domains: ['www.youtube.com'],
      urlPatterns: [/youtube.*\.js/, /iframe_api/],
    },
  },
  {
    vendor: 'Vimeo',
    category: 'media',
    patterns: {
      domains: ['player.vimeo.com'],
      urlPatterns: [/vimeo.*\.js/],
    },
  },
  {
    vendor: 'Wistia',
    category: 'media',
    patterns: {
      domains: ['fast.wistia.com'],
      urlPatterns: [/wistia.*\.js/],
    },
  },

  // ===== E-COMMERCE SPECIFIC =====
  {
    vendor: 'Recharge',
    category: 'subscriptions',
    patterns: {
      domains: ['cdn.rechargeapps.com'],
      urlPatterns: [/recharge.*\.js/],
    },
  },
  {
    vendor: 'Bold Commerce',
    category: 'shopify-app',
    patterns: {
      domains: ['cdn.boldapps.net'],
      urlPatterns: [/bold.*\.js/],
    },
  },
  {
    vendor: 'Shogun',
    category: 'page-builder',
    patterns: {
      domains: ['lib.getshogun.com'],
      urlPatterns: [/shogun.*\.js/],
    },
  },
  {
    vendor: 'Gem Pages',
    category: 'page-builder',
    patterns: {
      domains: ['assets.gempages.net'],
      urlPatterns: [/gempages.*\.js/],
    },
  },
  {
    vendor: 'PageFly',
    category: 'page-builder',
    patterns: {
      domains: ['assets.pagefly.io'],
      urlPatterns: [/pagefly.*\.js/],
    },
  },
  {
    vendor: 'Gorgias Helpdesk',
    category: 'helpdesk',
    patterns: {
      domains: ['storage.googleapis.com'],
      urlPatterns: [/gorgias.*\.js/],
    },
  },
  {
    vendor: 'Tidio Chat',
    category: 'chat',
    patterns: {
      domains: ['code.tidio.co'],
      urlPatterns: [/tidio.*\.js/],
    },
  },
  {
    vendor: 'Okendo',
    category: 'reviews',
    patterns: {
      domains: ['cdn-static.okendo.io'],
      urlPatterns: [/okendo.*\.js/],
    },
  },
  {
    vendor: 'Bazaarvoice',
    category: 'reviews',
    patterns: {
      domains: ['display.ugc.bazaarvoice.com'],
      urlPatterns: [/bazaarvoice.*\.js/],
    },
  },
  {
    vendor: 'Instafeed',
    category: 'social',
    patterns: {
      domains: ['cdn.jsdelivr.net'],
      urlPatterns: [/instafeed.*\.js/],
    },
  },
  {
    vendor: 'Tapcart',
    category: 'mobile-app',
    patterns: {
      domains: ['sdk.tapcart.com'],
      urlPatterns: [/tapcart.*\.js/],
    },
  },
];

/**
 * Detect vendor and category from a script URL
 */
export function detectScript(url: string): {
  vendor: string | null;
  category: string | null;
  isBlocking: boolean;
} {
  const urlLower = url.toLowerCase();
  const urlObj = new URL(url);
  const domain = urlObj.hostname.toLowerCase();

  for (const signature of THIRD_PARTY_SIGNATURES) {
    let domainMatched = false;

    // Check domain matches
    if (signature.patterns.domains) {
      for (const sigDomain of signature.patterns.domains) {
        if (domain.includes(sigDomain.toLowerCase())) {
          domainMatched = true;
          break;
        }
      }
    }

    // If domain matched, or if there are no domain patterns (URL-only signature), check URL patterns
    if (domainMatched || !signature.patterns.domains) {
      // Check URL pattern matches
      if (signature.patterns.urlPatterns) {
        for (const pattern of signature.patterns.urlPatterns) {
          if (pattern.test(urlLower)) {
            return {
              vendor: signature.vendor,
              category: signature.category,
              isBlocking: signature.isBlocking || false,
            };
          }
        }
      }

      // If domain matched but no URL pattern check was needed, return the match
      if (domainMatched) {
        return {
          vendor: signature.vendor,
          category: signature.category,
          isBlocking: signature.isBlocking || false,
        };
      }
    }
  }

  // No match found
  return {
    vendor: null,
    category: null,
    isBlocking: false,
  };
}

/**
 * Extract domain from URL
 */
export function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    return 'unknown';
  }
}

/**
 * Check if a script URL is third-party (not from the main site)
 */
export function isThirdPartyScript(scriptUrl: string, siteUrl: string): boolean {
  try {
    const scriptDomain = new URL(scriptUrl).hostname;
    const siteDomain = new URL(siteUrl).hostname;

    // Remove 'www.' prefix for comparison
    const cleanScriptDomain = scriptDomain.replace(/^www\./, '');
    const cleanSiteDomain = siteDomain.replace(/^www\./, '');

    return cleanScriptDomain !== cleanSiteDomain;
  } catch {
    return false;
  }
}
