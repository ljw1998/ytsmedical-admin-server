/**
 * NinjaVan Sandbox Dashboard Verification via Playwright
 *
 * Logs into the sandbox dashboard and verifies test orders.
 * Run: NODE_PATH="C:\nvm4w\nodejs\node_modules" node src/tests/ninjavan-playwright-verify.js
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const DASHBOARD_URL = 'https://dashboard-sandbox.ninjavan.co';
const LOGIN_EMAIL = 'yongthaisiong93@gmail.com';
const LOGIN_PASSWORD = 'Ninja123';
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');

// Load tracking numbers from API test output
let trackingNumbers = {};
const trackingFile = path.join(__dirname, 'test-tracking-numbers.json');
if (fs.existsSync(trackingFile)) {
  trackingNumbers = JSON.parse(fs.readFileSync(trackingFile, 'utf-8'));
  console.log('Loaded tracking numbers:', trackingNumbers);
} else {
  console.log('No test-tracking-numbers.json found. Provide tracking numbers manually.');
  process.exit(1);
}

// Ensure screenshot directory exists
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function login(page) {
  console.log('\n=== Logging into NinjaVan Sandbox Dashboard ===');
  await page.goto(`${DASHBOARD_URL}/login-v2`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);

  await page.locator('input[name="email"]').fill(LOGIN_EMAIL);
  await page.locator('input[type="password"]').fill(LOGIN_PASSWORD);
  await page.locator('button[type="submit"]').first().click();

  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(5000);

  // Dismiss popup if present
  try {
    await page.locator('button:has-text("Got it")').click({ timeout: 3000 });
  } catch (e) {}

  console.log(`Logged in. URL: ${page.url()}`);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01-dashboard-home.png'), fullPage: true });
}

async function verifyOrderInHistory(page, trackingNumber, label) {
  console.log(`\n=== Verifying ${label}: ${trackingNumber} ===`);

  // Navigate to Order History
  await page.goto(`${DASHBOARD_URL}/home/order-history`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);

  // Search for tracking number
  const searchInput = page.locator('input[placeholder*="Tracking"], input[placeholder*="tracking"], input[placeholder*="Search"], input[placeholder*="search"]').first();

  if (await searchInput.isVisible().catch(() => false)) {
    await searchInput.fill(trackingNumber);
    await searchInput.press('Enter');
    await page.waitForTimeout(3000);
    console.log(`Searched for: ${trackingNumber}`);
  } else {
    console.log('Search input not found, checking page directly...');
  }

  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, `02-order-history-${label}.png`),
    fullPage: true,
  });

  // Check if tracking number appears in page text
  const bodyText = await page.textContent('body');
  const found = bodyText.includes(trackingNumber);
  console.log(`${label} order ${found ? 'FOUND' : 'NOT FOUND'} in Order History`);

  return found;
}

async function verifyOrderStatus(page, trackingNumber, expectedStatus, label) {
  console.log(`\n=== Checking status for ${label}: ${trackingNumber} ===`);

  // Use the tracking page to check status
  await page.goto(`${DASHBOARD_URL}/home/tracking`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);

  // Search for tracking number in the tracking page
  const searchInput = page.locator('input[placeholder*="Tracking"], input[placeholder*="tracking"], input[placeholder*="Search"], input[placeholder*="search"]').first();

  if (await searchInput.isVisible().catch(() => false)) {
    await searchInput.fill(trackingNumber);
    await searchInput.press('Enter');
    await page.waitForTimeout(4000);
  }

  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, `03-tracking-${label}.png`),
    fullPage: true,
  });

  // Get page text and check for expected status
  const bodyText = await page.textContent('body');
  const statusFound = bodyText.toLowerCase().includes(expectedStatus.toLowerCase());
  console.log(`Expected status "${expectedStatus}": ${statusFound ? 'FOUND' : 'NOT FOUND'}`);

  // Extract visible status-related text
  const visibleText = await page.evaluate(() => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
    const texts = [];
    let node;
    while (node = walker.nextNode()) {
      const t = node.textContent.trim();
      if (t && t.length > 1 && t.length < 200 &&
          (t.toLowerCase().includes('status') || t.toLowerCase().includes('cancel') ||
           t.toLowerCase().includes('pending') || t.toLowerCase().includes('pickup') ||
           t.toLowerCase().includes('transit') || t.toLowerCase().includes('deliver'))) {
        texts.push(t);
      }
    }
    return [...new Set(texts)];
  });

  if (visibleText.length > 0) {
    console.log('Status-related text found on page:');
    visibleText.forEach(t => console.log(`  - ${t}`));
  }

  return statusFound;
}

async function main() {
  console.log('==========================================');
  console.log('  NinjaVan Dashboard Playwright Verify');
  console.log('==========================================');

  const browser = await chromium.launch({ headless: false, slowMo: 300 });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  try {
    // Login
    await login(page);

    // Verify Standard Order exists in Order History
    if (trackingNumbers.standard) {
      await verifyOrderInHistory(page, trackingNumbers.standard, 'standard');
    }

    // Verify COD Order exists in Order History
    if (trackingNumbers.cod) {
      await verifyOrderInHistory(page, trackingNumbers.cod, 'cod');
    }

    // Verify COD Order is Cancelled (Step 5 cancel test)
    if (trackingNumbers.cod) {
      await verifyOrderStatus(page, trackingNumbers.cod, 'Cancelled', 'cod-cancelled');
    }

    // Verify Standard Order still exists (not cancelled)
    if (trackingNumbers.standard) {
      await verifyOrderStatus(page, trackingNumbers.standard, 'Pending', 'standard-pending');
    }

    console.log('\n==========================================');
    console.log('  VERIFICATION COMPLETE');
    console.log('==========================================');
    console.log(`Screenshots saved to: ${SCREENSHOT_DIR}`);

  } catch (error) {
    console.error('Verification error:', error.message);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'error.png'), fullPage: true });
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
