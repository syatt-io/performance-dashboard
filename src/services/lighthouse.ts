import { prisma } from './database';
import { alertService } from './alertService';
import { shopifyMetricsCollector } from './shopifyMetrics';
import { exec } from 'child_process';
import { promisify } from 'util';
import { GoogleAuth } from 'google-auth-library';
import { decryptCredentials } from '../utils/encryption';

const execAsync = promisify(exec);

export interface LighthouseConfig {
  deviceType: 'mobile' | 'desktop';
  location?: string;
  throttling?: boolean;
}

export interface LighthouseResult {
  lcp?: number;
  fid?: number;
  cls?: number;
  inp?: number;
  fcp?: number;
  ttfb?: number;
  speedIndex?: number;
  tbt?: number;
  performanceScore?: number;
  imageOptimizationScore?: number;
  themeAssetSize?: number;
  thirdPartyBlockingTime?: number;
  // WebPageTest-specific fields
  loadTime?: number;
  fullyLoadedTime?: number;
  bytesIn?: number;
  requests?: number;
  visualProgress?: any;
  lighthouseData?: any;
  error?: string;
  success: boolean;
}

export class PerformanceCollector {
  // Track which sites have had Shopify collection in this session to avoid duplication
  private shopifyCollectedThisSession = new Set<string>();

  private async getGoogleAccessToken(): Promise<string | null> {
    try {
      // Check if service account is provided via base64 environment variable
      if (process.env.GOOGLE_SERVICE_ACCOUNT_BASE64) {
        console.log('🔐 Using Google Service Account from environment variable');

        const fs = require('fs');
        const path = require('path');
        const serviceAccountPath = '/tmp/service-account.json';

        // Decode and write service account to temp file
        const serviceAccountJson = Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf-8');
        fs.writeFileSync(serviceAccountPath, serviceAccountJson);
        process.env.GOOGLE_APPLICATION_CREDENTIALS = serviceAccountPath;

        console.log('✅ Service account decoded and saved to temp file');
      }

      // Check if service account credentials are available
      if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        console.log('📝 No service account credentials found, checking for API key...');
        return null;
      }

      console.log('🔐 Attempting Google Service Account authentication (direct method)');
      console.log(`📁 Service account file: ${process.env.GOOGLE_APPLICATION_CREDENTIALS}`);

      // Check if file exists
      const fs = require('fs');
      if (!fs.existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)) {
        console.error('❌ Service account file does not exist:', process.env.GOOGLE_APPLICATION_CREDENTIALS);
        return null;
      }

      // Try direct service account authentication without OAuth scopes
      // PageSpeed Insights API may work better with default service account auth
      console.log('🔄 Attempting direct service account authentication...');

      const auth = new GoogleAuth({
        keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
        scopes: ['openid'],
      });

      console.log('🔄 Getting auth client...');
      const client = await auth.getClient();

      console.log('🔄 Getting access token...');
      const accessTokenResponse = await client.getAccessToken();

      // Get project info from the auth client
      const projectId = await auth.getProjectId();
      console.log('🔍 Service account project info:', {
        projectId: projectId,
        hasToken: !!accessTokenResponse.token,
        tokenLength: accessTokenResponse.token?.length || 0,
        hasRes: !!accessTokenResponse.res
      });

      // Also read the service account file to see what project it contains
      try {
        const serviceAccountData = JSON.parse(fs.readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8'));
        console.log('📋 Service account file project_id:', serviceAccountData.project_id);
        console.log('📋 Service account client_email:', serviceAccountData.client_email);
      } catch (error) {
        console.warn('⚠️ Could not read service account file for debugging:', error.message);
      }

      if (accessTokenResponse.token) {
        console.log('✅ Successfully obtained service account access token (direct method)');
        console.log(`🔑 Token length: ${accessTokenResponse.token.length} characters`);
        console.log(`🔑 Token prefix: ${accessTokenResponse.token.substring(0, 20)}...`);
        return accessTokenResponse.token;
      } else {
        console.error('❌ Failed to obtain access token from service account - no token in response');
        return null;
      }
    } catch (error) {
      console.error('❌ Service account authentication failed with detailed error:');
      console.error('📝 Error name:', error.name);
      console.error('📝 Error message:', error.message);
      if (error.code) {
        console.error('📝 Error code:', error.code);
      }
      console.log('📝 Falling back to API key or free tier...');
      return null;
    }
  }

  async collectMetricsLocally(url: string, config: LighthouseConfig = { deviceType: 'mobile' }): Promise<LighthouseResult> {
    console.log(`🖥️ Starting local Lighthouse CLI collection for ${url} (${config.deviceType})`);
    console.log(`📌 Using local Lighthouse as fallback/primary method`);
    console.log(`⏰ Timestamp: ${new Date().toISOString()}`);

    try {
      // Use Lighthouse CLI for better compatibility
      const formFactor = config.deviceType === 'mobile' ? 'mobile' : 'desktop';
      const throttling = config.deviceType === 'mobile' ? '--throttling-method=simulate' : '--throttling-method=devtools';

      // Set Chrome path for macOS
      const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

      // Check if Chrome exists
      let chromeAvailable = false;
      try {
        await execAsync(`test -f "${chromePath}"`);
        console.log(`✅ Chrome found at ${chromePath}`);
        chromeAvailable = true;
      } catch {
        console.warn(`⚠️ Chrome not found at default path, trying system Chrome`);
        // Try to find Chrome in PATH
        try {
          const { stdout: whichChrome } = await execAsync('which google-chrome || which chromium || which chrome');
          if (whichChrome.trim()) {
            console.log(`✅ Alternative Chrome found at: ${whichChrome.trim()}`);
            chromeAvailable = true;
          }
        } catch {
          console.error(`❌ No Chrome/Chromium installation found in system PATH`);
        }
      }

      // Check if Lighthouse is available
      let lighthouseVersion = 'unknown';
      try {
        const { stdout: versionOutput } = await execAsync('npx lighthouse --version');
        lighthouseVersion = versionOutput.trim();
        console.log(`✅ Lighthouse version: ${lighthouseVersion}`);
      } catch (versionError) {
        console.error(`❌ Failed to get Lighthouse version:`, versionError);
        throw new Error('Lighthouse CLI not available. Please ensure Lighthouse is installed.');
      }

      const command = `export CHROME_PATH="${chromePath}" && npx lighthouse "${url}" --only-categories=performance --output=json --chrome-flags="--headless" --emulated-form-factor=${formFactor} ${throttling} --quiet`;

      console.log(`🔧 Running Lighthouse command...`);
      console.log(`📝 Command details: formFactor=${formFactor}, throttling=${throttling}`);

      const startTime = Date.now();
      const { stdout, stderr } = await execAsync(command, {
        timeout: 120000, // 2 minute timeout
        maxBuffer: 1024 * 1024 * 10 // 10MB buffer
      });

      const executionTime = Date.now() - startTime;
      console.log(`⏱️ Lighthouse execution completed in ${(executionTime / 1000).toFixed(2)} seconds`);

      // Log any stderr warnings (non-fatal)
      if (stderr && stderr.trim()) {
        console.warn(`⚠️ Lighthouse warnings: ${stderr.trim()}`);
      }

      // Validate JSON output
      let lhr;
      try {
        lhr = JSON.parse(stdout);
      } catch (parseError) {
        console.error(`❌ Failed to parse Lighthouse output as JSON`);
        console.error(`📝 Raw output (first 500 chars): ${stdout.substring(0, 500)}`);
        throw new Error(`Invalid Lighthouse output format: ${parseError.message}`);
      }
      const audits = lhr.audits;

      if (!audits) {
        console.error(`❌ No audits property found in Lighthouse result`);
        console.error(`📝 Lighthouse result keys: ${Object.keys(lhr || {}).join(', ')}`);
        throw new Error('No audits found in Lighthouse result');
      }

      // Log available audit types for debugging
      console.log(`📋 Available audits: ${Object.keys(audits).length} audit types`);
      const coreAudits = ['largest-contentful-paint', 'cumulative-layout-shift', 'first-contentful-paint', 'speed-index'];
      const missingAudits = coreAudits.filter(audit => !audits[audit]);
      if (missingAudits.length > 0) {
        console.warn(`⚠️ Missing expected audits: ${missingAudits.join(', ')}`);
      }

      // Extract Core Web Vitals and performance metrics (same format as PageSpeed API)
      const lcp = audits['largest-contentful-paint']?.numericValue ? audits['largest-contentful-paint'].numericValue / 1000 : undefined;
      const fid = audits['max-potential-fid']?.numericValue || undefined;
      const cls = audits['cumulative-layout-shift']?.numericValue || undefined;
      const fcp = audits['first-contentful-paint']?.numericValue ? audits['first-contentful-paint'].numericValue / 1000 : undefined;
      const ttfb = audits['server-response-time']?.numericValue || undefined;
      const speedIndex = audits['speed-index']?.numericValue ? audits['speed-index'].numericValue / 1000 : undefined;
      const tbt = audits['total-blocking-time']?.numericValue || undefined;
      const performanceScore = lhr.categories?.performance?.score ? Math.round(lhr.categories.performance.score * 100) : undefined;

      // Validate critical metrics
      if (lcp === undefined && fcp === undefined && performanceScore === undefined) {
        console.error(`❌ No valid performance metrics extracted from Lighthouse result`);
        console.error(`📝 Audit values: LCP=${lcp}, FCP=${fcp}, CLS=${cls}, Performance=${performanceScore}`);
        throw new Error('Failed to extract any valid performance metrics from Lighthouse result');
      }

      // Extract Shopify-specific image optimization metrics
      const imageOptimization = {
        unoptimizedImages: audits['uses-optimized-images']?.details?.items?.length || 0,
        unoptimizedImageBytes: audits['uses-optimized-images']?.details?.overallSavingsBytes || 0,
        nextGenFormatScore: Math.round((audits['uses-webp-images']?.score || 0) * 100),
        nextGenFormatSavings: audits['uses-webp-images']?.details?.overallSavingsBytes || 0,
        appropriatelySizedScore: Math.round((audits['uses-responsive-images']?.score || 0) * 100),
        appropriatelySizedSavings: audits['uses-responsive-images']?.details?.overallSavingsBytes || 0,
        lazyLoadingScore: Math.round((audits['offscreen-images']?.score || 0) * 100),
        lazyLoadingSavings: audits['offscreen-images']?.details?.overallSavingsBytes || 0
      };

      const imageOptimizationScore = Math.round(
        (imageOptimization.nextGenFormatScore +
         imageOptimization.appropriatelySizedScore +
         imageOptimization.lazyLoadingScore) / 3
      );

      const themeAssets = {
        totalByteWeight: audits['total-byte-weight']?.numericValue || 0,
        unusedCssBytes: audits['unused-css-rules']?.details?.totalBytes || 0,
        unusedJsBytes: audits['unused-javascript']?.details?.totalBytes || 0,
        renderBlockingResources: audits['render-blocking-resources']?.details?.items?.length || 0,
        renderBlockingBytes: audits['render-blocking-resources']?.details?.totalBytes || 0,
      };

      const thirdPartyImpact = {
        blockingTime: audits['third-party-summary']?.numericValue || 0,
        transferSize: audits['third-party-summary']?.details?.items?.reduce((sum: number, item: any) =>
          sum + (item.transferSize || 0), 0) || 0,
        requestCount: audits['third-party-summary']?.details?.items?.length || 0
      };

      console.log(`✅ Local Lighthouse CLI metrics - LCP: ${lcp?.toFixed(2)}s, CLS: ${cls?.toFixed(3)}, Performance: ${performanceScore}/100`);

      return {
        success: true,
        lcp,
        fid,
        cls,
        inp: undefined, // Local Lighthouse doesn't provide INP
        fcp,
        ttfb,
        speedIndex,
        tbt,
        performanceScore,
        imageOptimizationScore,
        themeAssetSize: themeAssets.totalByteWeight,
        thirdPartyBlockingTime: thirdPartyImpact.blockingTime,
        lighthouseData: {
          url,
          deviceType: config.deviceType,
          timestamp: new Date().toISOString(),
          testProvider: 'lighthouse-local',
          imageOptimization,
          themeAssets,
          thirdPartyImpact,
          note: 'Local Lighthouse CLI data with Shopify-specific metrics'
        }
      };

    } catch (error) {
      console.error(`❌ Local Lighthouse CLI collection failed for ${url}:`, error);

      // Provide specific error messages based on the error type
      let errorMessage = 'Unknown error occurred';
      let errorDetails: { type?: string } = {};

      if (error instanceof Error) {
        errorMessage = error.message;

        // Check for common error patterns
        if (errorMessage.includes('command not found') || errorMessage.includes('not found')) {
          errorMessage = 'Lighthouse CLI not found. Please ensure Lighthouse is installed (npm install -g lighthouse)';
          errorDetails = { type: 'lighthouse_not_found' };
        } else if (errorMessage.includes('ECONNREFUSED')) {
          errorMessage = 'Chrome failed to start or connect. Please ensure Chrome is installed and accessible';
          errorDetails = { type: 'chrome_connection_failed' };
        } else if (errorMessage.includes('TIMEOUT') || errorMessage.includes('timeout')) {
          errorMessage = `Lighthouse timed out analyzing ${url}. The site may be slow or unresponsive`;
          errorDetails = { type: 'timeout' };
        } else if (errorMessage.includes('PROTOCOL_TIMEOUT')) {
          errorMessage = 'Chrome DevTools Protocol timeout. The page may have heavy JavaScript preventing analysis';
          errorDetails = { type: 'protocol_timeout' };
        } else if (errorMessage.includes('NO_FCP') || errorMessage.includes('NO_LCP')) {
          errorMessage = 'Page failed to render content. The URL may be invalid or the page may be blocking rendering';
          errorDetails = { type: 'no_content_rendered' };
        } else if (errorMessage.includes('maxBuffer')) {
          errorMessage = 'Lighthouse output too large. The page may have too much content to analyze';
          errorDetails = { type: 'output_overflow' };
        } else if (errorMessage.includes('Invalid Lighthouse output')) {
          errorMessage = 'Lighthouse produced invalid output. This may indicate a Chrome crash or Lighthouse bug';
          errorDetails = { type: 'invalid_output' };
        }
      }

      console.error(`📝 Error type: ${errorDetails.type || 'general'}`);
      console.error(`📝 Error message: ${errorMessage}`);
      console.error(`📝 Stack trace:`, error instanceof Error ? error.stack : 'No stack trace available');

      return {
        success: false,
        error: `Local performance analysis failed: ${errorMessage}`,
        lighthouseData: {
          url,
          deviceType: config.deviceType,
          timestamp: new Date().toISOString(),
          error: errorMessage,
          errorDetails,
          note: 'Failed local CLI collection attempt'
        }
      };
    }
  }

  async collectMetricsWebPageTest(url: string, config: LighthouseConfig = { deviceType: 'mobile' }): Promise<LighthouseResult> {
    console.log(`🌐 Starting WebPageTest collection for ${url} (${config.deviceType})`);
    console.log(`🔑 Using WebPageTest API (1000 tests/month)`);

    const apiKey = process.env.WEBPAGETEST_API_KEY;
    if (!apiKey) {
      throw new Error('WebPageTest API key not found. Please set WEBPAGETEST_API_KEY environment variable.');
    }

    console.log(`🔑 API Key: ${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}`);

    // Enhanced fetch with anti-Cloudflare measures
    // FlareSolverr helper function for bypassing Cloudflare
    const bypassWithFlareSolverr = async (targetUrl: string, maxTimeout = 60000, customHeaders = {}): Promise<Response> => {
      const flaresolverrUrl = process.env.FLARESOLVERR_URL || 'http://localhost:8191/v1';

      console.log('🔥 Attempting to bypass Cloudflare with FlareSolverr...');
      console.log(`🌐 Target URL: ${targetUrl}`);

      const payload = {
        cmd: 'request.get',
        url: targetUrl,
        maxTimeout,
        ...(Object.keys(customHeaders).length > 0 && { headers: customHeaders })
      };

      try {
        const response = await fetch(flaresolverrUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          throw new Error(`FlareSolverr request failed: ${response.status} ${response.statusText}`);
        }

        const flareData = await response.json();

        if (flareData.status !== 'ok') {
          throw new Error(`FlareSolverr failed: ${flareData.message || 'Unknown error'}`);
        }

        console.log('✅ FlareSolverr successfully bypassed Cloudflare!');
        console.log(`📊 Status: ${flareData.solution.status}`);

        // Extract JSON from HTML response if needed
        let responseText = flareData.solution.response;

        // If the response is HTML with JSON inside <pre> tags, extract it
        if (responseText.includes('<pre>') && responseText.includes('</pre>')) {
          const preMatch = responseText.match(/<pre>(.*?)<\/pre>/s);
          if (preMatch) {
            responseText = preMatch[1];
            console.log('🔧 Extracted JSON from HTML wrapper');
          }
        }

        // Return a Response-like object with the FlareSolverr data
        return {
          ok: flareData.solution.status >= 200 && flareData.solution.status < 300,
          status: flareData.solution.status,
          statusText: `${flareData.solution.status}`,
          headers: new Headers(flareData.solution.headers || {}),
          text: () => Promise.resolve(responseText),
          json: () => {
            try {
              const parsed = JSON.parse(responseText);
              return Promise.resolve(parsed);
            } catch (e) {
              return Promise.reject(new Error(`Invalid JSON in FlareSolverr response: ${e.message}`));
            }
          }
        } as Response;

      } catch (error) {
        console.error('❌ FlareSolverr bypass failed:', error.message);
        throw error;
      }
    };

    const fetchWithAntiBot = async (targetUrl: string, options: any, maxRetries = 3): Promise<Response> => {
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(`🔄 Attempt ${attempt}/${maxRetries}: ${options.method || 'GET'} ${targetUrl}`);

          // More realistic browser headers to avoid Cloudflare detection
          const realisticHeaders = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/html, application/xhtml+xml, application/xml;q=0.9, image/webp, image/apng, */*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
            'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
            'Sec-Ch-Ua-Mobile': '?0',
            'Sec-Ch-Ua-Platform': '"macOS"',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'Upgrade-Insecure-Requests': '1',
            'Connection': 'keep-alive',
            ...(options.headers || {})
          };

          // Determine if this is a new Catchpoint API key (longer format)
          const isCatchpointKey = apiKey.length > 40 && apiKey.includes('-');

          let urlWithKey = new URL(targetUrl);
          let apiHeaders = {};

          if (isCatchpointKey) {
            // New Catchpoint API - use header authentication
            apiHeaders['X-WPT-API-KEY'] = apiKey;
            console.log('🔑 Using Catchpoint API header authentication');
          } else {
            // Legacy WebPageTest API - use URL parameter
            if (!urlWithKey.searchParams.has('k') && !urlWithKey.searchParams.has('key')) {
              urlWithKey.searchParams.set('k', apiKey);
            }
            console.log('🔑 Using legacy WebPageTest URL parameter authentication');
          }

          console.log(`📡 Making request to: ${urlWithKey.origin}${urlWithKey.pathname}`);
          console.log(`🔧 Headers: ${Object.keys(realisticHeaders).join(', ')}`);

          const response = await fetch(urlWithKey.toString(), {
            ...options,
            headers: {
              ...realisticHeaders,
              ...apiHeaders
            }
          });

          console.log(`📊 Response status: ${response.status}, content-type: ${response.headers.get('content-type')}`);

          // Read response once
          const responseText = await response.text();

          // Enhanced Cloudflare detection and bypass
          const isCloudflareChallenge = responseText.includes('cloudflare') && responseText.includes('challenge');
          const isCloudflareBlock = response.status === 403 && (
            responseText.includes('Cloudflare') ||
            responseText.includes('cloudflare') ||
            responseText.includes('cf-') ||
            responseText.includes('attention required')
          );

          if (isCloudflareChallenge || isCloudflareBlock) {
            console.warn(`⚠️ Attempt ${attempt}: Cloudflare challenge detected (status: ${response.status})`);
            console.log(`📄 Response snippet: ${responseText.substring(0, 300)}...`);
            console.log(`🔍 Detection flags - challenge: ${isCloudflareChallenge}, block: ${isCloudflareBlock}`);

            // Try FlareSolverr bypass for Cloudflare challenge
            try {
              console.log('🔥 Switching to FlareSolverr for Cloudflare bypass...');
              let urlForFlare = new URL(targetUrl);
              let flareHeaders = {};

              if (isCatchpointKey) {
                // For Catchpoint API, pass headers through FlareSolverr
                flareHeaders['X-WPT-API-KEY'] = apiKey;
              } else {
                // For legacy API, add key to URL
                if (!urlForFlare.searchParams.has('k') && !urlForFlare.searchParams.has('key')) {
                  urlForFlare.searchParams.set('k', apiKey);
                }
              }

              const flareResponse = await bypassWithFlareSolverr(urlForFlare.toString(), 60000, flareHeaders);
              console.log('✅ FlareSolverr bypass successful!');
              return flareResponse;
            } catch (flareError) {
              console.error('❌ FlareSolverr bypass failed:', flareError.message);

              // If FlareSolverr fails and we have more retries, continue with normal retry
              if (attempt < maxRetries) {
                const delay = Math.pow(2, attempt) * 2000 + (Math.random() * 1000);
                console.log(`⏳ Waiting ${delay.toFixed(0)}ms before retry with different approach...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
              }
              throw new Error('Cloudflare is blocking WebPageTest API requests after all retries (FlareSolverr also failed)');
            }
          }

          // Check for rate limiting
          if (response.status === 429) {
            const retryAfter = response.headers.get('retry-after');
            const delay = retryAfter ? parseInt(retryAfter) * 1000 : Math.pow(2, attempt) * 3000;
            console.warn(`⚠️ Attempt ${attempt}: Rate limited (429), waiting ${delay}ms...`);

            if (attempt < maxRetries) {
              await new Promise(resolve => setTimeout(resolve, delay));
              continue;
            }
          }

          // Return wrapped response with pre-read text
          return {
            ok: response.ok,
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
            text: () => Promise.resolve(responseText),
            json: () => {
              try {
                const parsed = JSON.parse(responseText);
                console.log(`✅ Successfully parsed JSON response`);
                return Promise.resolve(parsed);
              } catch (e) {
                console.error(`❌ JSON parse error: ${e.message}`);
                console.log(`📄 Raw response: ${responseText.substring(0, 500)}...`);
                return Promise.reject(new Error(`Invalid JSON response: ${e.message}`));
              }
            }
          } as Response;

        } catch (error) {
          console.error(`❌ Attempt ${attempt} failed:`, error.message);
          if (attempt === maxRetries) throw error;

          const delay = Math.pow(2, attempt) * 1500 + (Math.random() * 500);
          console.log(`⏳ Waiting ${delay.toFixed(0)}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
      throw new Error('All retry attempts failed');
    };

    try {
      // Step 1: Submit test using POST method (more reliable than GET)
      const testUrl = 'https://www.webpagetest.org/runtest.php';
      // Determine API key type
      const isCatchpointKey = apiKey.length > 40 && apiKey.includes('-');

      let testData = {
        url: url,
        location: config.location || 'ec2-us-east-1:Chrome',
        mobile: config.deviceType === 'mobile' ? '1' : '0',
        f: 'json',
        runs: '1',
        lighthouse: '1',
        fvonly: '1'
      };

      // Only add API key to URL params for legacy API
      if (!isCatchpointKey) {
        testData.k = apiKey;
      }

      console.log(`🚀 Submitting test to WebPageTest via POST...`);

      // Build URL with parameters instead of POST body to avoid Cloudflare inspection
      const submitUrl = new URL(testUrl);
      Object.entries(testData).forEach(([key, value]) => {
        submitUrl.searchParams.set(key, value);
      });

      let requestHeaders = {
        'Content-Type': 'application/x-www-form-urlencoded',
      };

      // Add API key header for Catchpoint API
      if (isCatchpointKey) {
        requestHeaders['X-WPT-API-KEY'] = apiKey;
        console.log('🔑 Using Catchpoint API with header authentication');
      } else {
        console.log('🔑 Using legacy WebPageTest API with URL parameter authentication');
      }

      const submitResponse = await fetchWithAntiBot(submitUrl.toString(), {
        method: 'GET', // Use GET with URL params instead of POST
        headers: requestHeaders
      });

      console.log(`📊 Response status: ${submitResponse.status}, ok: ${submitResponse.ok}`);

      let submitData;
      try {
        submitData = await submitResponse.json();
        console.log(`📊 WebPageTest response:`, JSON.stringify(submitData, null, 2));
      } catch (jsonError) {
        const errorText = await submitResponse.text();
        throw new Error(`WebPageTest submission failed - invalid JSON response (HTTP ${submitResponse.status}): ${errorText}`);
      }

      if (submitData.statusCode !== 200) {
        throw new Error(`WebPageTest submission error: ${submitData.statusText || 'Unknown error'}`);
      }

      const testId = submitData.data.testId;
      const userUrl = submitData.data.userUrl;
      console.log(`✅ Test submitted successfully. Test ID: ${testId}`);
      console.log(`🔗 Test URL: ${userUrl}`);

      // Step 2: Poll for results
      const resultsUrl = `https://www.webpagetest.org/jsonResult.php?test=${testId}`;
      let attempts = 0;
      const maxAttempts = 30; // 5 minutes max wait (10 second intervals)

      console.log(`⏳ Polling for test results...`);

      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
        attempts++;

        console.log(`🔄 Poll attempt ${attempts}/${maxAttempts}: Checking test status...`);

        try {
          const resultsResponse = await fetchWithAntiBot(resultsUrl, { method: 'GET' });

          if (!resultsResponse.ok) {
            console.warn(`⚠️ Results fetch failed (${resultsResponse.status}), retrying...`);
            continue;
          }

          const resultsData = await resultsResponse.json();

          if (resultsData.statusCode === 200) {
          console.log(`✅ Test completed! Processing results...`);

          // Extract metrics from WebPageTest results
          const run = resultsData.data.runs['1'].firstView;
          const lighthouse = resultsData.data.runs['1'].firstView.lighthouse;

          // Core Web Vitals from Lighthouse data within WebPageTest
          const lcp = lighthouse?.audits?.['largest-contentful-paint']?.numericValue
            ? lighthouse.audits['largest-contentful-paint'].numericValue / 1000 : undefined;
          const cls = lighthouse?.audits?.['cumulative-layout-shift']?.numericValue || undefined;
          const fcp = lighthouse?.audits?.['first-contentful-paint']?.numericValue
            ? lighthouse.audits['first-contentful-paint'].numericValue / 1000 : undefined;
          const speedIndex = lighthouse?.audits?.['speed-index']?.numericValue
            ? lighthouse.audits['speed-index'].numericValue / 1000 : undefined;
          const tbt = lighthouse?.audits?.['total-blocking-time']?.numericValue || undefined;
          const performanceScore = lighthouse?.categories?.performance?.score
            ? Math.round(lighthouse.categories.performance.score * 100) : undefined;

          // WebPageTest-specific metrics
          const loadTime = run.loadTime ? run.loadTime / 1000 : undefined; // Convert to seconds
          const fullyLoadedTime = run.fullyLoaded ? run.fullyLoaded / 1000 : undefined;
          const ttfb = run.TTFB || undefined;
          const bytesIn = run.bytesIn || undefined;
          const requests = run.requests || undefined;

          // Extract image optimization data from Lighthouse audits
          const imageOptimization = {
            unoptimizedImages: lighthouse?.audits?.['uses-optimized-images']?.details?.items?.length || 0,
            unoptimizedImageBytes: lighthouse?.audits?.['uses-optimized-images']?.details?.overallSavingsBytes || 0,
            nextGenFormatScore: Math.round((lighthouse?.audits?.['uses-webp-images']?.score || 0) * 100),
            nextGenFormatSavings: lighthouse?.audits?.['uses-webp-images']?.details?.overallSavingsBytes || 0,
            appropriatelySizedScore: Math.round((lighthouse?.audits?.['uses-responsive-images']?.score || 0) * 100),
            appropriatelySizedSavings: lighthouse?.audits?.['uses-responsive-images']?.details?.overallSavingsBytes || 0,
            lazyLoadingScore: Math.round((lighthouse?.audits?.['offscreen-images']?.score || 0) * 100),
            lazyLoadingSavings: lighthouse?.audits?.['offscreen-images']?.details?.overallSavingsBytes || 0
          };

          const imageOptimizationScore = Math.round(
            (imageOptimization.nextGenFormatScore +
             imageOptimization.appropriatelySizedScore +
             imageOptimization.lazyLoadingScore) / 3
          );

          // Theme asset analysis
          const themeAssets = {
            totalByteWeight: lighthouse?.audits?.['total-byte-weight']?.numericValue || bytesIn || 0,
            unusedCssBytes: lighthouse?.audits?.['unused-css-rules']?.details?.totalBytes || 0,
            unusedJsBytes: lighthouse?.audits?.['unused-javascript']?.details?.totalBytes || 0,
            renderBlockingResources: lighthouse?.audits?.['render-blocking-resources']?.details?.items?.length || 0,
            renderBlockingBytes: lighthouse?.audits?.['render-blocking-resources']?.details?.totalBytes || 0,
          };

          // Third-party impact
          const thirdPartyImpact = {
            blockingTime: lighthouse?.audits?.['third-party-summary']?.numericValue || 0,
            transferSize: lighthouse?.audits?.['third-party-summary']?.details?.items?.reduce((sum: number, item: any) =>
              sum + (item.transferSize || 0), 0) || 0,
            requestCount: lighthouse?.audits?.['third-party-summary']?.details?.items?.length || 0
          };

          // Visual progress data for filmstrip
          const visualProgress = run.videoFrames ? run.videoFrames.map((frame: any) => ({
            time: frame.time,
            visualComplete: frame.VisuallyComplete,
            image: frame.image
          })) : undefined;

          console.log(`✅ WebPageTest metrics - LCP: ${lcp?.toFixed(2)}s, CLS: ${cls?.toFixed(3)}, Performance: ${performanceScore}/100`);
          console.log(`📊 WebPageTest specifics - Load: ${loadTime?.toFixed(2)}s, Fully Loaded: ${fullyLoadedTime?.toFixed(2)}s, Requests: ${requests}`);
          console.log(`🖼️ Image optimization score: ${imageOptimizationScore}/100 (${imageOptimization.unoptimizedImages} unoptimized images)`);

          return {
            success: true,
            lcp,
            fid: undefined, // WebPageTest doesn't provide FID directly
            cls,
            inp: undefined, // Not available in WebPageTest
            fcp,
            ttfb,
            speedIndex,
            tbt,
            performanceScore,
            imageOptimizationScore,
            themeAssetSize: themeAssets.totalByteWeight,
            thirdPartyBlockingTime: thirdPartyImpact.blockingTime,
            // WebPageTest-specific data
            loadTime,
            fullyLoadedTime,
            bytesIn,
            requests,
            visualProgress,
            lighthouseData: {
              url,
              deviceType: config.deviceType,
              timestamp: new Date().toISOString(),
              testProvider: 'webpagetest',
              testId,
              userUrl,
              location: config.location || 'ec2-us-east-1:Chrome',
              imageOptimization,
              themeAssets,
              thirdPartyImpact,
              visualProgress,
              note: 'WebPageTest data with embedded Lighthouse results (raw data removed to save space)'
            }
          };
        } else if (resultsData.statusCode === 101) {
            console.log(`⏳ Test still running (${resultsData.statusText})...`);
            continue;
          } else {
            throw new Error(`WebPageTest error: ${resultsData.statusText}`);
          }
        } catch (error) {
          console.error(`❌ Error during polling attempt ${attempts}: ${error.message}`);
          if (attempts >= maxAttempts) {
            throw error;
          }
          // Continue to next attempt after the delay
        }
      }

      throw new Error(`WebPageTest timeout: Test did not complete within ${maxAttempts * 10} seconds`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error(`❌ WebPageTest collection failed for ${url}:`, error);

      return {
        success: false,
        error: `WebPageTest analysis failed: ${errorMessage}`,
        lighthouseData: {
          url,
          deviceType: config.deviceType,
          timestamp: new Date().toISOString(),
          testProvider: 'webpagetest',
          error: errorMessage,
          note: 'Failed WebPageTest collection attempt'
        }
      };
    }
  }

  async collectMetrics(url: string, config: LighthouseConfig = { deviceType: 'mobile' }): Promise<LighthouseResult> {
    console.log(`📊 Using PageSpeed Insights API with Service Account Authentication`);
    console.log(`🔑 PageSpeed API Key: ${process.env.PAGESPEED_API_KEY ? 'Available' : 'Not set'}`);
    console.log(`🔑 Service Account: ${process.env.GOOGLE_APPLICATION_CREDENTIALS ? 'Available' : 'Not set'}`);

    // Use PageSpeed Insights with service account authentication (25k requests/day limit)
    const result = await this.collectMetricsPageSpeed(url, config);

    // If PageSpeed fails, we fail completely
    if (!result.success) {
      throw new Error(`PageSpeed Insights failed: ${result.error} - 25k daily limit should be sufficient`);
    }

    return result;
  }

  async collectMetricsPageSpeed(url: string, config: LighthouseConfig = { deviceType: 'mobile' }): Promise<LighthouseResult> {
    console.log(`📊 Starting PageSpeed Insights collection for ${url} (${config.deviceType})`);
    console.log(`🔑 Using PageSpeed Insights API (not simulated data)`);

    try {
      // Use PageSpeed Insights API instead of local Lighthouse
      const strategy = config.deviceType === 'mobile' ? 'mobile' : 'desktop';

      // Build PageSpeed Insights API URL
      const baseUrl = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';
      const params = new URLSearchParams({
        url: url,
        strategy: strategy,
        category: 'performance'
      });

      // Initialize headers for potential authentication
      let headers: HeadersInit = {};

      // Use service account for authentication (25k requests/day limit)
      const accessToken = await this.getGoogleAccessToken();

      if (accessToken) {
        console.log('🔑 Using Service Account (Bearer token) authentication - 25k requests/day');
        console.log(`🎯 Service account token prefix: ${accessToken.substring(0, 20)}...`);
        headers['Authorization'] = `Bearer ${accessToken}`;
      } else {
        // Fall back to API key if no service account
        const apiKey = process.env.PAGESPEED_API_KEY;
        if (apiKey) {
          console.log('🔑 Using API Key authentication (fallback)');
          params.append('key', apiKey);
        } else {
          console.log('📝 Using free tier (no authentication) - limited to 25-100 requests/day');
        }
      }

      const apiUrl = `${baseUrl}?${params.toString()}`;

      console.log('⚡ Calling PageSpeed Insights API...');
      console.log(`📍 API URL: ${baseUrl}`);
      console.log(`📍 Full API URL: ${apiUrl}`);
      console.log(`📍 Request headers:`, headers);
      console.log(`📍 URL parameters:`, Object.fromEntries(params));

      const response = await fetch(apiUrl, { headers });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`PageSpeed API failed (${response.status}): ${errorText}`);
      }

      const data = await response.json();

      // Debug: Log raw API response structure
      console.log('🔍 Raw PageSpeed API response for debugging:');
      console.log('- Response status:', response.status);
      console.log('- Has loadingExperience:', !!data.loadingExperience);
      console.log('- Has originLoadingExperience:', !!data.originLoadingExperience);
      console.log('- Has lighthouseResult:', !!data.lighthouseResult);
      console.log('- Performance score (raw):', data.lighthouseResult?.categories?.performance?.score);
      console.log('- Field data availability:', {
        LARGEST_CONTENTFUL_PAINT_MS: !!data.loadingExperience?.metrics?.LARGEST_CONTENTFUL_PAINT_MS,
        FIRST_CONTENTFUL_PAINT_MS: !!data.loadingExperience?.metrics?.FIRST_CONTENTFUL_PAINT_MS,
        CUMULATIVE_LAYOUT_SHIFT_SCORE: !!data.loadingExperience?.metrics?.CUMULATIVE_LAYOUT_SHIFT_SCORE,
        INTERACTION_TO_NEXT_PAINT: !!data.loadingExperience?.metrics?.INTERACTION_TO_NEXT_PAINT
      });
      console.log('- Lab audits availability:', {
        'largest-contentful-paint': !!data.lighthouseResult?.audits?.['largest-contentful-paint'],
        'cumulative-layout-shift': !!data.lighthouseResult?.audits?.['cumulative-layout-shift'],
        'first-contentful-paint': !!data.lighthouseResult?.audits?.['first-contentful-paint'],
        'speed-index': !!data.lighthouseResult?.audits?.['speed-index']
      });
      if (data.loadingExperience?.metrics) {
        console.log('- Field LCP (ms):', data.loadingExperience.metrics.LARGEST_CONTENTFUL_PAINT_MS?.percentile);
        console.log('- Field CLS (0-100):', data.loadingExperience.metrics.CUMULATIVE_LAYOUT_SHIFT_SCORE?.percentile);
      }
      if (data.lighthouseResult?.audits) {
        console.log('- Lab LCP (ms):', data.lighthouseResult.audits['largest-contentful-paint']?.numericValue);
        console.log('- Lab CLS (0-1):', data.lighthouseResult.audits['cumulative-layout-shift']?.numericValue);
      }

      if (!data.lighthouseResult) {
        throw new Error('No Lighthouse result in PageSpeed response');
      }

      const { lighthouseResult } = data;
      const audits = lighthouseResult.audits;

      // Extract Core Web Vitals and performance metrics
      // Prefer field data (real users) over lab data when available
      const fieldData = data.loadingExperience?.metrics;
      const originFieldData = data.originLoadingExperience?.metrics;

      // LCP - prefer field data, fallback to lab data (convert ms to seconds)
      const lcp = fieldData?.LARGEST_CONTENTFUL_PAINT_MS?.percentile
        ? fieldData.LARGEST_CONTENTFUL_PAINT_MS.percentile / 1000
        : (audits['largest-contentful-paint']?.numericValue ? audits['largest-contentful-paint'].numericValue / 1000 : undefined);

      // INP (replaced FID in 2024) - only available in field data
      const inp = fieldData?.INTERACTION_TO_NEXT_PAINT?.percentile || undefined;

      // Legacy FID for compatibility - use max-potential-fid from lab as fallback
      const fid = inp || (audits['max-potential-fid']?.numericValue || undefined);

      // CLS - prefer field data, fallback to lab data
      const cls = fieldData?.CUMULATIVE_LAYOUT_SHIFT_SCORE?.percentile !== undefined
        ? fieldData.CUMULATIVE_LAYOUT_SHIFT_SCORE.percentile / 100  // Field data is 0-100 scale, convert to 0-1
        : (audits['cumulative-layout-shift']?.numericValue || undefined);

      // FCP - prefer field data, fallback to lab data (convert ms to seconds)
      const fcp = fieldData?.FIRST_CONTENTFUL_PAINT_MS?.percentile
        ? fieldData.FIRST_CONTENTFUL_PAINT_MS.percentile / 1000
        : (audits['first-contentful-paint']?.numericValue ? audits['first-contentful-paint'].numericValue / 1000 : undefined);

      // TTFB - prefer field data, fallback to server response time
      const ttfb = fieldData?.EXPERIMENTAL_TIME_TO_FIRST_BYTE?.percentile
        || (audits['server-response-time']?.numericValue || undefined);

      // Speed Index - only available in lab data (convert ms to seconds)
      const speedIndex = audits['speed-index']?.numericValue ? audits['speed-index'].numericValue / 1000 : undefined;

      // Total Blocking Time - only available in lab data
      const tbt = audits['total-blocking-time']?.numericValue || undefined;

      const performanceScore = lighthouseResult.categories?.performance?.score ? Math.round(lighthouseResult.categories.performance.score * 100) : undefined;

      // Extract Shopify-specific image optimization metrics
      const imageOptimization = {
        unoptimizedImages: audits['uses-optimized-images']?.details?.items?.length || 0,
        unoptimizedImageBytes: audits['uses-optimized-images']?.details?.overallSavingsBytes || 0,
        nextGenFormatScore: Math.round((audits['uses-webp-images']?.score || 0) * 100),
        nextGenFormatSavings: audits['uses-webp-images']?.details?.overallSavingsBytes || 0,
        appropriatelySizedScore: Math.round((audits['uses-responsive-images']?.score || 0) * 100),
        appropriatelySizedSavings: audits['uses-responsive-images']?.details?.overallSavingsBytes || 0,
        lazyLoadingScore: Math.round((audits['offscreen-images']?.score || 0) * 100),
        lazyLoadingSavings: audits['offscreen-images']?.details?.overallSavingsBytes || 0
      };

      // Calculate overall image optimization score (0-100)
      const imageOptimizationScore = Math.round(
        (imageOptimization.nextGenFormatScore +
         imageOptimization.appropriatelySizedScore +
         imageOptimization.lazyLoadingScore) / 3
      );

      // Extract theme asset analysis
      const themeAssets = {
        totalByteWeight: audits['total-byte-weight']?.numericValue || 0,
        unusedCssBytes: audits['unused-css-rules']?.details?.totalBytes || 0,
        unusedJsBytes: audits['unused-javascript']?.details?.totalBytes || 0,
        renderBlockingResources: audits['render-blocking-resources']?.details?.items?.length || 0,
        renderBlockingBytes: audits['render-blocking-resources']?.details?.totalBytes || 0,
        largestBundleSize: Math.max(
          audits['unused-css-rules']?.details?.totalBytes || 0,
          audits['unused-javascript']?.details?.totalBytes || 0
        )
      };

      // Extract third-party impact
      const thirdPartyImpact = {
        blockingTime: audits['third-party-summary']?.numericValue || 0,
        transferSize: audits['third-party-summary']?.details?.items?.reduce((sum: number, item: any) =>
          sum + (item.transferSize || 0), 0) || 0,
        requestCount: audits['third-party-summary']?.details?.items?.length || 0
      };

      // Log data sources for debugging
      const hasFieldData = !!fieldData;
      const dataSource = hasFieldData ? 'field+lab' : 'lab-only';
      const dataSourceDetails = {
        lcp: fieldData?.LARGEST_CONTENTFUL_PAINT_MS?.percentile ? 'field' : 'lab',
        cls: fieldData?.CUMULATIVE_LAYOUT_SHIFT_SCORE?.percentile !== undefined ? 'field' : 'lab',
        fcp: fieldData?.FIRST_CONTENTFUL_PAINT_MS?.percentile ? 'field' : 'lab'
      };
      console.log(`✅ PageSpeed Insights metrics (${dataSource}) - LCP: ${lcp?.toFixed(2)}s (${dataSourceDetails.lcp}), CLS: ${cls?.toFixed(3)} (${dataSourceDetails.cls}), Performance: ${performanceScore}/100`);
      console.log(`🖼️ Image optimization score: ${imageOptimizationScore}/100 (${imageOptimization.unoptimizedImages} unoptimized images)`);
      console.log(`📦 Theme assets: ${Math.round(themeAssets.totalByteWeight / 1024)}KB total, ${themeAssets.renderBlockingResources} blocking resources`);
      console.log(`📊 Raw field data - LCP: ${fieldData?.LARGEST_CONTENTFUL_PAINT_MS?.percentile}ms, CLS: ${fieldData?.CUMULATIVE_LAYOUT_SHIFT_SCORE?.percentile}, FCP: ${fieldData?.FIRST_CONTENTFUL_PAINT_MS?.percentile}ms`);

      return {
        success: true,
        lcp,
        fid,
        cls,
        inp,
        fcp,
        ttfb,
        speedIndex,
        tbt,
        performanceScore,
        // New Shopify-specific metrics
        imageOptimizationScore,
        themeAssetSize: themeAssets.totalByteWeight,
        thirdPartyBlockingTime: thirdPartyImpact.blockingTime,
        lighthouseData: {
          url,
          deviceType: config.deviceType,
          timestamp: new Date().toISOString(),
          testProvider: 'pagespeed',
          imageOptimization,
          themeAssets,
          thirdPartyImpact,
          note: 'Real PageSpeed Insights data with Shopify-specific metrics (raw report removed to save space)'
        }
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error(`❌ PageSpeed Insights collection failed for ${url}:`, error);

      // TESTING: Local Lighthouse fallback DISABLED - service account authentication only
      // const errorString = String(error);
      // const shouldFallback = errorMessage.includes('429') ||
      //                      errorMessage.includes('quota') ||
      //                      errorMessage.includes('authentication') ||
      //                      errorMessage.includes('RATE_LIMIT_EXCEEDED') ||
      //                      errorMessage.includes('RESOURCE_EXHAUSTED') ||
      //                      errorMessage.includes('insufficientPermissions') ||
      //                      errorMessage.includes('PERMISSION_DENIED') ||
      //                      errorString.includes('429') ||
      //                      errorString.includes('quota') ||
      //                      errorString.includes('Quota exceeded');

      // if (shouldFallback) {
      //   console.log(`🔄 PageSpeed API quota/auth issue detected, falling back to local Lighthouse...`);
      //   console.log(`📝 Original error was: ${errorMessage}`);
      //   console.log(`📊 Fallback reason: API quota exhausted or authentication issue`);
      //   console.log(`⏰ Fallback initiated at: ${new Date().toISOString()}`);

      //   const localResult = await this.collectMetricsLocally(url, config);

      //   if (localResult.success) {
      //     console.log(`✅ Local Lighthouse fallback succeeded`);
      //     console.log(`📈 Metrics collected: LCP=${localResult.lcp?.toFixed(2)}s, CLS=${localResult.cls?.toFixed(3)}, Performance=${localResult.performanceScore}/100`);
      //     // Add a note to the lighthouse data that this was a fallback
      //     if (localResult.lighthouseData) {
      //       localResult.lighthouseData.fallbackReason = 'PageSpeed API quota/auth error';
      //       localResult.lighthouseData.originalError = errorMessage;
      //     }
      //   } else {
      //     console.log(`❌ Local Lighthouse fallback also failed`);
      //     console.log(`📝 Fallback error: ${localResult.error}`);
      //     // Include both errors in the response
      //     localResult.error = `Primary API failed: ${errorMessage}. Fallback also failed: ${localResult.error}`;
      //   }
      //   return localResult;
      // }

      console.log(`❌ PageSpeed API failed, local Lighthouse fallback is DISABLED for testing`);
      console.log(`📝 Original error: ${errorMessage}`);

      // For other errors, return error result
      return {
        success: false,
        error: `Performance analysis failed: ${errorMessage}. Please check that the URL is accessible and try again.`,
        lighthouseData: {
          url,
          deviceType: config.deviceType,
          timestamp: new Date().toISOString(),
          note: 'Failed collection attempt'
        }
      };
    }
  }

  async collectAndStore(siteId: string, url: string, config: LighthouseConfig = { deviceType: 'mobile' }): Promise<string> {
    try {
      console.log(`🔍 [${config.deviceType.toUpperCase()}] Starting performance collection for ${url}`);

      // Use collectMetrics which now uses PageSpeed Insights with Service Account (25k requests/day)
      console.log(`📡 [${config.deviceType.toUpperCase()}] Using PageSpeed Insights API with Service Account...`);
      const metrics = await this.collectMetrics(url, config);

      // Check if collection was successful
      if (!metrics.success) {
        console.error(`❌ [${config.deviceType.toUpperCase()}] Failed to collect metrics for ${url}:`, metrics.error);
        throw new Error(`Performance analysis failed: ${metrics.error}`);
      }

      console.log(`💾 [${config.deviceType.toUpperCase()}] Storing metrics to database...`);

      // Only store if we have real data
      const performanceMetric = await prisma.performanceMetric.create({
        data: {
          siteId,
          deviceType: config.deviceType,
          lcp: metrics.lcp,
          fid: metrics.fid,
          cls: metrics.cls,
          inp: metrics.inp,
          fcp: metrics.fcp,
          ttfb: metrics.ttfb,
          speedIndex: metrics.speedIndex,
          tbt: metrics.tbt,
          performanceScore: metrics.performanceScore,
          // Shopify-specific metrics
          imageOptimizationScore: metrics.imageOptimizationScore,
          themeAssetSize: metrics.themeAssetSize,
          thirdPartyBlockingTime: metrics.thirdPartyBlockingTime,
          // WebPageTest-specific metrics
          visualProgress: metrics.visualProgress,
          loadTime: metrics.loadTime,
          fullyLoadedTime: metrics.fullyLoadedTime,
          bytesIn: metrics.bytesIn,
          requests: metrics.requests,
          testProvider: metrics.lighthouseData?.testProvider || 'unknown',
          testId: metrics.lighthouseData?.testId,
          lighthouseData: metrics.lighthouseData,
          location: config.location
        }
      });

      console.log(`✅ [${config.deviceType.toUpperCase()}] Successfully stored metrics for ${url} - DB ID: ${performanceMetric.id}`);
      console.log(`📊 [${config.deviceType.toUpperCase()}] Metrics: LCP=${metrics.lcp?.toFixed(2)}s, CLS=${metrics.cls?.toFixed(3)}, Performance=${metrics.performanceScore}/100`);

      // Log data source for debugging
      const testProvider = metrics.lighthouseData?.testProvider || 'unknown';
      const dataSource = testProvider === 'webpagetest' ? 'WebPageTest API' :
                        testProvider === 'pagespeed' ? 'PageSpeed Insights API' :
                        metrics.lighthouseData?.fallbackReason ? 'Local Lighthouse (fallback)' : 'Unknown';
      console.log(`🔍 [${config.deviceType.toUpperCase()}] Data source: ${dataSource}`);

      // Log additional WebPageTest metrics if available
      if (testProvider === 'webpagetest') {
        console.log(`📊 [${config.deviceType.toUpperCase()}] WebPageTest extras: Load=${metrics.loadTime?.toFixed(2)}s, Fully Loaded=${metrics.fullyLoadedTime?.toFixed(2)}s, Requests=${metrics.requests}`);
        if (metrics.lighthouseData?.testId) {
          console.log(`🔗 [${config.deviceType.toUpperCase()}] Test URL: https://www.webpagetest.org/result/${metrics.lighthouseData.testId}`);
        }
      }

      console.log(`🚨 [${config.deviceType.toUpperCase()}] Processing through alert service...`);
      // Process metrics through alert service
      await alertService.processMetric(siteId, {
        deviceType: config.deviceType,
        performanceScore: metrics.performanceScore,
        lcp: metrics.lcp,
        cls: metrics.cls,
        fid: metrics.fid,
        fcp: metrics.fcp,
        ttfb: metrics.ttfb,
        speedIndex: metrics.speedIndex,
        tbt: metrics.tbt
      });

      console.log(`✅ [${config.deviceType.toUpperCase()}] Alert processing complete for ${url}`);

      // Check if this is a Shopify store and collect additional metrics (only once per site per session)
      console.log(`🔍 [${config.deviceType.toUpperCase()}] Calling checkAndCollectShopifyMetrics for site ${siteId}`);
      await this.checkAndCollectShopifyMetrics(siteId);

      return performanceMetric.id;

    } catch (error) {
      console.error(`❌ [${config.deviceType.toUpperCase()}] collectAndStore failed for ${url}:`, error);
      console.error(`📝 [${config.deviceType.toUpperCase()}] Error type: ${error.constructor.name}`);
      console.error(`📝 [${config.deviceType.toUpperCase()}] Error message: ${error.message}`);
      throw error;
    }
  }

  async collectForSite(siteId: string): Promise<void> {
    const site = await prisma.site.findUnique({
      where: { id: siteId }
    });

    if (!site || !site.isActive) {
      throw new Error(`Site ${siteId} not found or inactive`);
    }

    console.log(`\n🎯 ================================================`);
    console.log(`🎯 Starting collection for site: ${site.name}`);
    console.log(`🌐 URL: ${site.url}`);
    console.log(`🆔 Site ID: ${siteId}`);
    console.log(`⏰ Start time: ${new Date().toISOString()}`);
    console.log(`🎯 ================================================`);

    // Ensure default performance budgets exist for this site
    try {
      await alertService.createDefaultBudgets(siteId);
    } catch (error) {
      console.warn(`⚠️ Could not create default budgets for site ${siteId}:`, error);
    }

    // Collect metrics for mobile and desktop separately to see which fails
    const results = [];

    console.log(`📱 Starting MOBILE collection for ${site.name}...`);
    try {
      const mobileResult = await this.collectAndStore(siteId, site.url, { deviceType: 'mobile' });
      console.log(`✅ MOBILE collection succeeded for ${site.name} - Metric ID: ${mobileResult}`);
      results.push({ device: 'mobile', success: true, id: mobileResult });
    } catch (error) {
      console.error(`❌ MOBILE collection failed for ${site.name}:`, error);
      results.push({ device: 'mobile', success: false, error: error.message });
    }

    console.log(`🖥️ Starting DESKTOP collection for ${site.name}...`);
    try {
      const desktopResult = await this.collectAndStore(siteId, site.url, { deviceType: 'desktop' });
      console.log(`✅ DESKTOP collection succeeded for ${site.name} - Metric ID: ${desktopResult}`);
      results.push({ device: 'desktop', success: true, id: desktopResult });
    } catch (error) {
      console.error(`❌ DESKTOP collection failed for ${site.name}:`, error);
      results.push({ device: 'desktop', success: false, error: error.message });
    }

    // Log summary for this site
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    console.log(`\n📊 ================================================`);
    console.log(`📊 Collection summary for ${site.name}:`);
    console.log(`✅ Successful collections: ${successCount}/2`);
    console.log(`❌ Failed collections: ${failureCount}/2`);
    if (failureCount > 0) {
      console.log(`📝 Failures:`, results.filter(r => !r.success).map(r => `${r.device}: ${r.error}`));
    }
    console.log(`⏰ End time: ${new Date().toISOString()}`);
    console.log(`📊 ================================================\n`);

    // Check if this is a Shopify store and collect additional metrics
    await this.checkAndCollectShopifyMetrics(siteId);

    // Check for performance regressions after collecting new data
    try {
      await alertService.checkForRegressions(siteId);
    } catch (error) {
      console.warn(`⚠️ Could not check for regressions for site ${siteId}:`, error);
    }
  }

  /**
   * Check if a site is a Shopify store and collect additional eCommerce metrics
   * Only runs once per site per collection session to avoid duplication
   */
  private async checkAndCollectShopifyMetrics(siteId: string): Promise<void> {
    // Skip if already collected for this site in this session
    if (this.shopifyCollectedThisSession.has(siteId)) {
      console.log(`🛍️ Shopify metrics already collected for site ${siteId} in this session, skipping`);
      return;
    }

    const site = await prisma.site.findUnique({
      where: { id: siteId }
    });

    if (!site) {
      console.warn(`⚠️ Site ${siteId} not found for Shopify detection`);
      return;
    }

    let isShopifyStore = false;

    // First check database configuration
    if (site.apiKey) {
      // Decrypt credentials before use
      const { apiKey } = decryptCredentials({ apiKey: site.apiKey });

      try {
        const config = JSON.parse(apiKey || '');
        isShopifyStore = config.isShopify === true;
      } catch {
        // Not a JSON config, check if URL contains shopify indicators
        isShopifyStore = site.url.includes('myshopify.com') ||
                        site.shopifyDomain !== null;
      }
    }

    // If not detected yet, check if the site is actually a Shopify store by checking headers
    if (!isShopifyStore) {
      try {
        console.log(`🔍 Checking if ${site.url} is a Shopify store...`);
        const checkResponse = await fetch(site.url, {
          method: 'HEAD',
          redirect: 'follow',
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; PerformanceDashboard/1.0)'
          }
        });

        // Check for Shopify-specific headers
        const poweredBy = checkResponse.headers.get('powered-by');
        const shopId = checkResponse.headers.get('x-shopid');
        const shopifyHeader = checkResponse.headers.get('x-shopify-stage');

        if (poweredBy?.toLowerCase().includes('shopify') || shopId || shopifyHeader) {
          isShopifyStore = true;
          console.log(`✅ Detected Shopify store via headers (x-shopid: ${shopId})`);
        }
      } catch (error) {
        console.log(`⚠️ Could not check Shopify headers for ${site.url}:`, error.message);
      }
    }

    if (isShopifyStore) {
      console.log(`🛍️ Detected Shopify store - collecting additional eCommerce metrics`);
      try {
        // Mark as collected for this session
        this.shopifyCollectedThisSession.add(siteId);
        await shopifyMetricsCollector.collectShopifyPageMetrics(siteId);
      } catch (error) {
        console.warn(`⚠️ Could not collect Shopify metrics for site ${siteId}:`, error);
        // Remove from collected set on failure so it can be retried
        this.shopifyCollectedThisSession.delete(siteId);
      }
    }
  }

  async collectForAllSites(): Promise<void> {
    const sites = await prisma.site.findMany({
      where: { isActive: true }
    });

    console.log(`🔄 Starting performance collection for ${sites.length} active sites`);

    // Clear the Shopify collection tracking for new batch
    this.shopifyCollectedThisSession.clear();

    // Process sites sequentially with delay to prevent system freeze
    for (const site of sites) {
      try {
        console.log(`📊 Processing site ${site.name} (${site.url})`);
        await this.collectForSite(site.id);

        // Add delay between sites to prevent overwhelming the system
        console.log(`⏱️ Waiting 5 seconds before next site...`);
        await new Promise(resolve => setTimeout(resolve, 5000));
      } catch (error) {
        console.error(`Failed to collect metrics for site ${site.name}:`, error);
      }
    }

    console.log(`✅ Performance collection completed for all sites`);
  }
}

export const performanceCollector = new PerformanceCollector();