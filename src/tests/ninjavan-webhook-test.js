/**
 * NinjaVan Webhook Endpoint Test
 *
 * Sends simulated webhook payloads with proper HMAC-SHA256 base64 signatures
 * to the local server to verify webhook processing works correctly.
 *
 * Prerequisites: Server must be running on PORT (default 5002)
 *
 * Run: node src/tests/ninjavan-webhook-test.js
 */

require('dotenv').config();
const axios = require('axios');
const crypto = require('crypto');

const SERVER_URL = `http://localhost:${process.env.PORT || 5002}`;
const WEBHOOK_URL = `${SERVER_URL}/api/webhooks/ninjavan/webhook`;
const CLIENT_SECRET = process.env.NINJAVAN_CLIENT_SECRET;

const results = [];

function log(test, status, details) {
  const icon = status === 'PASS' ? '[PASS]' : status === 'FAIL' ? '[FAIL]' : '[INFO]';
  console.log(`${icon} ${test}`);
  if (details) console.log(`       ${typeof details === 'object' ? JSON.stringify(details, null, 2) : details}`);
  results.push({ test, status, details });
}

function signPayload(body) {
  const hmac = crypto.createHmac('sha256', CLIENT_SECRET);
  hmac.update(body);
  return hmac.digest('base64');
}

async function sendWebhook(payload, { validSignature = true, label = '' } = {}) {
  const body = JSON.stringify(payload);
  const signature = validSignature ? signPayload(body) : 'invalidsignature==';

  try {
    const response = await axios.post(WEBHOOK_URL, body, {
      headers: {
        'Content-Type': 'application/json',
        'X-Ninjavan-Hmac-Sha256': signature,
      },
    });
    return { status: response.status, data: response.data };
  } catch (error) {
    return { status: error.response?.status, data: error.response?.data || error.message };
  }
}

// ============================================================
// Test 1: Webhook endpoint returns 200 immediately
// ============================================================
async function testEndpointReturns200() {
  console.log('\n=== Test 1: Endpoint returns 200 immediately ===');

  const payload = {
    tracking_id: 'TESTWEBHOOK001',
    status: 'Pending Pickup',
    timestamp: new Date().toISOString(),
    event: 'Pending Pickup',
    is_parcel_on_rts_leg: false,
  };

  const start = Date.now();
  const result = await sendWebhook(payload);
  const elapsed = Date.now() - start;

  log('Returns HTTP 200', result.status === 200 ? 'PASS' : 'FAIL', `Status: ${result.status}`);
  log('Response body has success=true', result.data?.success === true ? 'PASS' : 'FAIL', result.data);
  log(`Responds within 3 seconds (${elapsed}ms)`, elapsed < 3000 ? 'PASS' : 'FAIL', `${elapsed}ms`);
}

// ============================================================
// Test 2: Valid signature is accepted
// ============================================================
async function testValidSignature() {
  console.log('\n=== Test 2: Valid HMAC-SHA256 base64 signature ===');

  const payload = {
    tracking_id: 'TESTWEBHOOK002',
    status: 'Pending Pickup',
    timestamp: new Date().toISOString(),
    event: 'Pending Pickup',
    is_parcel_on_rts_leg: false,
  };

  const body = JSON.stringify(payload);
  const signature = signPayload(body);
  log('Signature format', 'INFO', `base64: ${signature}`);

  const result = await sendWebhook(payload, { validSignature: true });
  log('Valid signature accepted (200)', result.status === 200 ? 'PASS' : 'FAIL', `Status: ${result.status}`);

  // Wait a moment for async processing
  await new Promise(r => setTimeout(r, 2000));
}

// ============================================================
// Test 3: Invalid signature is rejected (still 200 but logged as ignored)
// ============================================================
async function testInvalidSignature() {
  console.log('\n=== Test 3: Invalid signature handling ===');

  const payload = {
    tracking_id: 'TESTWEBHOOK003',
    status: 'Pending Pickup',
    timestamp: new Date().toISOString(),
    event: 'Pending Pickup',
    is_parcel_on_rts_leg: false,
  };

  // Server still returns 200 (to acknowledge receipt) but should log as ignored
  const result = await sendWebhook(payload, { validSignature: false });
  log('Returns 200 even for invalid signature (per NinjaVan docs)', result.status === 200 ? 'PASS' : 'FAIL');

  await new Promise(r => setTimeout(r, 2000));
}

// ============================================================
// Test 4: Simulate full order lifecycle via webhooks
// ============================================================
async function testOrderLifecycleWebhooks() {
  console.log('\n=== Test 4: Simulated order lifecycle webhooks ===');

  // Use the tracking ID from our earlier test order (if it exists in DB)
  // For simulation, we'll use a fake tracking ID — the webhook will be processed
  // but marked as "ignored" (no matching order). This still tests the pipeline.
  const trackingId = 'NVSGYTSMDTMNZAOM79'; // From our test scenario #1

  const events = [
    { event: 'Pending Pickup', status: 'Pending Pickup' },
    { event: 'Picked Up, In Transit to Origin Hub', status: 'Picked Up' },
    { event: 'Arrived at Origin Hub', status: 'Arrived at Origin Hub' },
    { event: 'On Vehicle for Delivery', status: 'On Vehicle for Delivery' },
    { event: 'Delivered, Received by Customer', status: 'Delivered' },
  ];

  for (const evt of events) {
    const payload = {
      tracking_id: trackingId,
      shipper_order_ref_no: 'TMNZAOM79',
      timestamp: new Date().toISOString(),
      event: evt.event,
      status: evt.status,
      is_parcel_on_rts_leg: false,
    };

    const result = await sendWebhook(payload);
    log(`Lifecycle: ${evt.event}`, result.status === 200 ? 'PASS' : 'FAIL', `HTTP ${result.status}`);
    await new Promise(r => setTimeout(r, 500));
  }
}

// ============================================================
// Test 5: Delivery exception (note event, no status change)
// ============================================================
async function testDeliveryException() {
  console.log('\n=== Test 5: Delivery exception webhook ===');

  const payload = {
    tracking_id: 'NVSGYTSMDTMNZAOM79',
    shipper_order_ref_no: 'TMNZAOM79',
    timestamp: new Date().toISOString(),
    event: 'Delivery Exception, Pending Reschedule',
    status: 'Delivery Exception',
    is_parcel_on_rts_leg: false,
    delivery_exception: {
      state: 'Pending Reschedule',
      failure_reason: 'Nobody at Location',
    },
  };

  const result = await sendWebhook(payload);
  log('Delivery Exception webhook', result.status === 200 ? 'PASS' : 'FAIL');
}

// ============================================================
// Test 6: Parcel Measurements Update
// ============================================================
async function testParcelMeasurements() {
  console.log('\n=== Test 6: Parcel Measurements Update webhook ===');

  const payload = {
    tracking_id: 'NVSGYTSMDTMNZAOM79',
    shipper_order_ref_no: 'TMNZAOM79',
    timestamp: new Date().toISOString(),
    event: 'Parcel Measurements Update',
    status: 'Parcel Measurements Update',
    is_parcel_on_rts_leg: false,
    parcel_measurements: {
      weight: 1.5,
      length: 30,
      width: 20,
      height: 15,
    },
  };

  const result = await sendWebhook(payload);
  log('Parcel Measurements webhook', result.status === 200 ? 'PASS' : 'FAIL');
}

// ============================================================
// Test 7: Return to Sender
// ============================================================
async function testReturnToSender() {
  console.log('\n=== Test 7: Returned to Sender webhook ===');

  const payload = {
    tracking_id: 'NVSGYTSMDTMNZAOM79',
    shipper_order_ref_no: 'TMNZAOM79',
    timestamp: new Date().toISOString(),
    event: 'Returned to Sender',
    status: 'Returned to Sender',
    is_parcel_on_rts_leg: true,
  };

  const result = await sendWebhook(payload);
  log('Returned to Sender webhook', result.status === 200 ? 'PASS' : 'FAIL');
}

// ============================================================
// Main
// ============================================================
async function main() {
  console.log('==========================================');
  console.log('  NinjaVan Webhook Endpoint Test');
  console.log('==========================================');
  console.log(`Webhook URL: ${WEBHOOK_URL}`);
  console.log(`Client Secret: ${CLIENT_SECRET?.substring(0, 8)}...`);

  await testEndpointReturns200();
  await testValidSignature();
  await testInvalidSignature();
  await testOrderLifecycleWebhooks();
  await testDeliveryException();
  await testParcelMeasurements();
  await testReturnToSender();

  // Summary
  console.log('\n==========================================');
  console.log('  TEST SUMMARY');
  console.log('==========================================');
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  console.log(`PASS: ${passed} | FAIL: ${failed}`);
}

main().catch(console.error);
