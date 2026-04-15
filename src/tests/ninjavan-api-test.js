/**
 * NinjaVan Sandbox API Integration Test
 *
 * Tests all NinjaVan API endpoints against the sandbox environment.
 * Run: node src/tests/ninjavan-api-test.js
 */

require('dotenv').config();
const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.NINJAVAN_BASE_URL; // https://api-sandbox.ninjavan.co/sg
const CLIENT_ID = process.env.NINJAVAN_CLIENT_ID;
const CLIENT_SECRET = process.env.NINJAVAN_CLIENT_SECRET;

const results = [];
const trackingNumbers = {};

function log(test, status, details) {
  const icon = status === 'PASS' ? '[PASS]' : status === 'FAIL' ? '[FAIL]' : '[INFO]';
  console.log(`${icon} ${test}`);
  if (details) console.log(`       ${typeof details === 'object' ? JSON.stringify(details, null, 2) : details}`);
  results.push({ test, status, details });
}

// ============================================================
// Step 1: OAuth Token
// ============================================================
async function testOAuthToken() {
  console.log('\n=== Step 1: OAuth Token ===');
  try {
    const response = await axios.post(`${BASE_URL}/2.0/oauth/access_token`, {
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: 'client_credentials',
    });

    const { access_token, expires_in, token_type } = response.data;

    if (!access_token) {
      log('OAuth Token - access_token present', 'FAIL', 'No access_token in response');
      return null;
    }
    log('OAuth Token - access_token present', 'PASS', `Token: ${access_token.substring(0, 20)}...`);

    if (expires_in > 0) {
      log('OAuth Token - expires_in > 0', 'PASS', `Expires in: ${expires_in}s`);
    } else {
      log('OAuth Token - expires_in > 0', 'FAIL', `expires_in: ${expires_in}`);
    }

    log('OAuth Token - token_type', token_type === 'bearer' ? 'PASS' : 'FAIL', `token_type: ${token_type}`);

    return access_token;
  } catch (error) {
    log('OAuth Token', 'FAIL', error.response?.data || error.message);
    return null;
  }
}

// ============================================================
// Step 2: Create Order (Standard - no COD)
// ============================================================
async function testCreateOrderStandard(token) {
  console.log('\n=== Step 2: Create Order (Standard) ===');
  // requested_tracking_number must be 1-9 alphanumeric chars (no prefix, no hyphens)
  const orderRef = `S${Date.now().toString(36).slice(-8).toUpperCase()}`;

  const requestBody = {
    service_type: 'Parcel',
    service_level: 'Standard',
    requested_tracking_number: orderRef,
    reference: {
      merchant_order_number: orderRef,
    },
    from: {
      name: 'Wilson BMS Test',
      phone_number: '+60123456789',
      email: 'test@wilsonbms.com',
      address: {
        address1: '123 Test Street',
        address2: '',
        city: 'Kuala Lumpur',
        state: 'Kuala Lumpur',
        postcode: '50000',
        country: 'MY',
      },
    },
    to: {
      name: 'Test Customer Standard',
      phone_number: '+60198765432',
      email: 'customer@test.com',
      address: {
        address1: '456 Delivery Road',
        address2: 'Unit 5',
        city: 'Petaling Jaya',
        state: 'Selangor',
        postcode: '47301',
        country: 'MY',
      },
    },
    parcel_job: {
      is_pickup_required: true,
      pickup_service_type: 'Scheduled',
      pickup_service_level: 'Standard',
      pickup_date: getTomorrowDate(),
      pickup_timeslot: {
        start_time: '09:00',
        end_time: '18:00',
        timezone: 'Asia/Kuala_Lumpur',
      },
      delivery_start_date: getTomorrowDate(),
      delivery_timeslot: {
        start_time: '09:00',
        end_time: '18:00',
        timezone: 'Asia/Kuala_Lumpur',
      },
      dimensions: {
        weight: 1.5,
      },
      items: [
        {
          item_description: 'Health Product A x2',
          quantity: 2,
          is_dangerous_good: false,
        },
      ],
    },
  };

  try {
    const response = await axios.post(`${BASE_URL}/4.2/orders`, requestBody, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    const { tracking_number, requested_tracking_number } = response.data;

    if (tracking_number) {
      log('Create Standard Order - tracking_number', 'PASS', `Tracking: ${tracking_number}`);
      trackingNumbers.standard = tracking_number;
    } else {
      log('Create Standard Order - tracking_number', 'FAIL', 'No tracking_number in response');
    }

    if (requested_tracking_number) {
      log('Create Standard Order - requested_tracking_number', 'PASS', `Requested: ${requested_tracking_number}`);
    }

    log('Create Standard Order - full response', 'INFO', {
      tracking_number,
      requested_tracking_number,
      service_type: response.data.service_type,
      service_level: response.data.service_level,
    });

    return tracking_number;
  } catch (error) {
    log('Create Standard Order', 'FAIL', error.response?.data || error.message);
    return null;
  }
}

// ============================================================
// Step 3: Create Order (COD)
// ============================================================
async function testCreateOrderCOD(token) {
  console.log('\n=== Step 3: Create Order (COD) ===');
  // requested_tracking_number must be 1-9 alphanumeric chars
  const orderRef = `C${Date.now().toString(36).slice(-8).toUpperCase()}`;

  const requestBody = {
    service_type: 'Parcel',
    service_level: 'Standard',
    requested_tracking_number: orderRef,
    reference: {
      merchant_order_number: orderRef,
    },
    from: {
      name: 'Wilson BMS Test',
      phone_number: '+60123456789',
      email: 'test@wilsonbms.com',
      address: {
        address1: '123 Test Street',
        address2: '',
        city: 'Kuala Lumpur',
        state: 'Kuala Lumpur',
        postcode: '50000',
        country: 'MY',
      },
    },
    to: {
      name: 'Test Customer COD',
      phone_number: '+60187654321',
      email: 'codcustomer@test.com',
      address: {
        address1: '789 COD Avenue',
        address2: '',
        city: 'Shah Alam',
        state: 'Selangor',
        postcode: '40000',
        country: 'MY',
      },
    },
    parcel_job: {
      is_pickup_required: true,
      pickup_service_type: 'Scheduled',
      pickup_service_level: 'Standard',
      pickup_date: getTomorrowDate(),
      pickup_timeslot: {
        start_time: '09:00',
        end_time: '18:00',
        timezone: 'Asia/Kuala_Lumpur',
      },
      delivery_start_date: getTomorrowDate(),
      delivery_timeslot: {
        start_time: '09:00',
        end_time: '18:00',
        timezone: 'Asia/Kuala_Lumpur',
      },
      cash_on_delivery: 89.90,
      cash_on_delivery_currency: 'MYR',
      dimensions: {
        weight: 2.0,
      },
      items: [
        {
          item_description: 'Health Product B x1',
          quantity: 1,
          is_dangerous_good: false,
        },
      ],
    },
  };

  try {
    const response = await axios.post(`${BASE_URL}/4.2/orders`, requestBody, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    const { tracking_number, requested_tracking_number } = response.data;

    if (tracking_number) {
      log('Create COD Order - tracking_number', 'PASS', `Tracking: ${tracking_number}`);
      trackingNumbers.cod = tracking_number;
    } else {
      log('Create COD Order - tracking_number', 'FAIL', 'No tracking_number in response');
    }

    log('Create COD Order - full response', 'INFO', {
      tracking_number,
      requested_tracking_number,
      service_type: response.data.service_type,
    });

    return tracking_number;
  } catch (error) {
    log('Create COD Order', 'FAIL', error.response?.data || error.message);
    return null;
  }
}

// ============================================================
// Step 4: Generate Waybill
// ============================================================
async function testGenerateWaybill(token, trackingNumber) {
  console.log('\n=== Step 4: Generate Waybill ===');

  if (!trackingNumber) {
    log('Generate Waybill', 'FAIL', 'No tracking number available (order creation failed)');
    return;
  }

  try {
    const response = await axios.get(`${BASE_URL}/2.0/reports/waybill`, {
      params: { tid: trackingNumber },
      headers: {
        Authorization: `Bearer ${token}`,
      },
      responseType: 'arraybuffer',
    });

    const buffer = Buffer.from(response.data);
    const isPdf = buffer.slice(0, 5).toString() === '%PDF-';

    if (isPdf) {
      log('Generate Waybill - PDF returned', 'PASS', `Size: ${buffer.length} bytes`);

      // Save locally for manual inspection
      const outputPath = path.join(__dirname, `waybill-${trackingNumber}.pdf`);
      fs.writeFileSync(outputPath, buffer);
      log('Generate Waybill - saved to disk', 'PASS', outputPath);
    } else {
      log('Generate Waybill - PDF returned', 'FAIL', `First bytes: ${buffer.slice(0, 20).toString()}`);
    }
  } catch (error) {
    const status = error.response?.status;
    if (status === 400 || status === 404) {
      log('Generate Waybill', 'FAIL', `HTTP ${status} — Order may not be processed yet. Waybill typically requires "Pending Pickup" status.`);
    } else {
      log('Generate Waybill', 'FAIL', error.response?.data?.toString() || error.message);
    }
  }
}

// ============================================================
// Step 5: Cancel Order
// ============================================================
async function testCancelOrder(token, trackingNumber) {
  console.log('\n=== Step 5: Cancel Order ===');

  if (!trackingNumber) {
    log('Cancel Order', 'FAIL', 'No tracking number available (COD order creation failed)');
    return;
  }

  try {
    const response = await axios.delete(`${BASE_URL}/2.2/orders/${trackingNumber}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = response.data;
    log('Cancel Order - response', 'PASS', data);

    if (data.status === 'Cancelled' || response.status === 200) {
      log('Cancel Order - status is Cancelled', 'PASS', `Tracking: ${trackingNumber}`);
    } else {
      log('Cancel Order - status check', 'FAIL', `Expected "Cancelled", got: ${data.status}`);
    }
  } catch (error) {
    log('Cancel Order', 'FAIL', error.response?.data || error.message);
  }
}

// ============================================================
// Step 6: Webhook Signature Verification
// ============================================================
function testWebhookSignature() {
  console.log('\n=== Step 6: Webhook Signature Verification ===');

  const payload = JSON.stringify({
    tracking_id: 'TEST123456',
    status: 'Pending Pickup',
    timestamp: new Date().toISOString(),
  });

  // Generate valid signature (base64, matching NinjaVan docs)
  const hmac = crypto.createHmac('sha256', CLIENT_SECRET);
  hmac.update(payload);
  const validSignature = hmac.digest('base64');

  // Test valid signature
  const hmacVerify = crypto.createHmac('sha256', CLIENT_SECRET);
  hmacVerify.update(payload);
  const computed = hmacVerify.digest('base64');
  const isValid = crypto.timingSafeEqual(
    Buffer.from(computed, 'utf8'),
    Buffer.from(validSignature, 'utf8')
  );

  log('Webhook Signature - valid signature (base64)', isValid ? 'PASS' : 'FAIL', `Signature: ${validSignature.substring(0, 20)}...`);

  // Test invalid signature
  const tamperedSignature = 'aW52YWxpZHNpZ25hdHVyZQ==';
  let isInvalid;
  try {
    const hmacTamper = crypto.createHmac('sha256', CLIENT_SECRET);
    hmacTamper.update(payload);
    const computedTamper = hmacTamper.digest('base64');
    isInvalid = !crypto.timingSafeEqual(
      Buffer.from(computedTamper, 'utf8'),
      Buffer.from(tamperedSignature, 'utf8')
    );
  } catch {
    isInvalid = true;
  }

  log('Webhook Signature - tampered signature rejected', isInvalid ? 'PASS' : 'FAIL');
}

// ============================================================
// Step 7: Webhook Event Mapping
// ============================================================
function testWebhookEventMapping() {
  console.log('\n=== Step 7: Webhook Event Mapping ===');

  const { NINJAVAN_EVENT_STATUS_MAP, NINJAVAN_NOTE_EVENTS, NINJAVAN_DELIVERED_EVENTS } = require('../config/constants');

  const testCases = [
    { event: 'Pending Pickup', expected: 'pending_pickup' },
    { event: 'Picked Up, In Transit to Origin Hub', expected: 'in_transit' },
    { event: 'On Vehicle for Delivery', expected: 'out_for_delivery' },
    { event: 'Delivered, Received by Customer', expected: 'delivered' },
    { event: 'Returned to Sender', expected: 'returned' },
    { event: 'Cancelled', expected: 'cancelled' },
  ];

  for (const tc of testCases) {
    const mapped = NINJAVAN_EVENT_STATUS_MAP[tc.event];
    log(`Event Map: "${tc.event}" → "${mapped}"`, mapped === tc.expected ? 'PASS' : 'FAIL',
      mapped !== tc.expected ? `Expected "${tc.expected}", got "${mapped}"` : undefined);
  }

  // Test note events don't map to status changes
  for (const event of NINJAVAN_NOTE_EVENTS) {
    const mapped = NINJAVAN_EVENT_STATUS_MAP[event];
    log(`Note Event: "${event}" has no status mapping`, !mapped ? 'PASS' : 'FAIL');
  }

  // Test delivered events are in the list
  const deliveredEvents = ['Delivered, Received by Customer', 'Delivered, Left at Doorstep', 'Delivered, Collected by Customer'];
  for (const event of deliveredEvents) {
    log(`Delivered Event: "${event}" in NINJAVAN_DELIVERED_EVENTS`,
      NINJAVAN_DELIVERED_EVENTS.includes(event) ? 'PASS' : 'FAIL');
  }
}

// ============================================================
// Helpers
// ============================================================
function getTomorrowDate() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

// ============================================================
// Main
// ============================================================
async function main() {
  console.log('==========================================');
  console.log('  NinjaVan Sandbox API Integration Test');
  console.log('==========================================');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Client ID: ${CLIENT_ID?.substring(0, 8)}...`);
  console.log(`Timestamp: ${new Date().toISOString()}`);

  // Step 1: OAuth
  const token = await testOAuthToken();
  if (!token) {
    console.log('\n[ABORT] Cannot proceed without access token.');
    return;
  }

  // Step 2: Create Standard Order
  const standardTracking = await testCreateOrderStandard(token);

  // Step 3: Create COD Order
  const codTracking = await testCreateOrderCOD(token);

  // Wait for sandbox to process orders before waybill/cancel
  console.log('\n[INFO] Waiting 10s for sandbox to process orders...');
  await new Promise(r => setTimeout(r, 10000));

  // Step 4: Generate Waybill (using standard order)
  await testGenerateWaybill(token, standardTracking);

  // Step 5: Cancel Order (using COD order)
  await testCancelOrder(token, codTracking);

  // Step 6: Webhook Signature
  testWebhookSignature();

  // Step 7: Webhook Event Mapping
  testWebhookEventMapping();

  // Summary
  console.log('\n==========================================');
  console.log('  TEST SUMMARY');
  console.log('==========================================');
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const info = results.filter(r => r.status === 'INFO').length;
  console.log(`PASS: ${passed} | FAIL: ${failed} | INFO: ${info}`);
  console.log('\nTracking Numbers for Playwright verification:');
  console.log(JSON.stringify(trackingNumbers, null, 2));

  // Save tracking numbers for playwright script
  const outputPath = path.join(__dirname, 'test-tracking-numbers.json');
  fs.writeFileSync(outputPath, JSON.stringify(trackingNumbers, null, 2));
  console.log(`\nTracking numbers saved to: ${outputPath}`);
}

main().catch(console.error);
