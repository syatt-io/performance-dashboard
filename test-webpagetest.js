#!/usr/bin/env node
require('dotenv').config();

// Simple WebPageTest API test
const API_KEY = process.env.WEBPAGETEST_API_KEY;
const TEST_URL = 'https://snugglebugz.ca/';

if (!API_KEY) {
  console.error('❌ WEBPAGETEST_API_KEY environment variable not set');
  process.exit(1);
}

async function testWebPageTest() {
  console.log('🚀 Testing WebPageTest API directly...');

  const testData = {
    url: TEST_URL,
    k: API_KEY,
    location: 'ec2-us-east-1:Chrome',
    mobile: '1',
    f: 'json',
    runs: '1',
    lighthouse: '1',
    fvonly: '1'
  };

  try {
    console.log('📤 Submitting test...');
    const submitResponse = await fetch('https://www.webpagetest.org/runtest.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      body: new URLSearchParams(testData).toString()
    });

    console.log(`📊 HTTP Status: ${submitResponse.status}`);
    console.log(`📊 Response OK: ${submitResponse.ok}`);
    console.log(`📊 Headers:`, Object.fromEntries(submitResponse.headers.entries()));

    const responseText = await submitResponse.text();
    console.log(`📄 Raw Response:`, responseText);

    try {
      const jsonData = JSON.parse(responseText);
      console.log(`✅ Parsed JSON:`, JSON.stringify(jsonData, null, 2));

      if (jsonData.statusCode === 200) {
        console.log(`🎉 SUCCESS! Test ID: ${jsonData.data.testId}`);
        console.log(`🔗 Test URL: ${jsonData.data.userUrl}`);
        return jsonData;
      } else {
        console.log(`❌ WebPageTest Error: ${jsonData.statusText}`);
      }
    } catch (parseError) {
      console.log(`❌ JSON Parse Error:`, parseError.message);
    }

  } catch (error) {
    console.log(`❌ Request Error:`, error.message);
  }
}

testWebPageTest();