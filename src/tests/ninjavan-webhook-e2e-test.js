/**
 * NinjaVan Webhook End-to-End Test
 *
 * Creates a real test order in Supabase, sends simulated webhooks,
 * and verifies the DB is updated correctly after each event.
 *
 * Prerequisites: Server must be running on PORT (default 5002)
 *
 * Run: node src/tests/ninjavan-webhook-e2e-test.js
 */

require('dotenv').config();
const axios = require('axios');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const SERVER_URL = `http://localhost:${process.env.PORT || 5002}`;
const WEBHOOK_URL = `${SERVER_URL}/api/webhooks/ninjavan/webhook`;
const CLIENT_SECRET = process.env.NINJAVAN_CLIENT_SECRET;
const TRACKING_NUMBER = `TESTWEBHOOK${Date.now().toString(36).toUpperCase()}`;

const results = [];
let testOrderId = null;
let testCustomerId = null;

function log(test, status, details) {
  const icon = status === 'PASS' ? '[PASS]' : status === 'FAIL' ? '[FAIL]' : '[INFO]';
  console.log(`${icon} ${test}`);
  if (details) console.log(`       ${typeof details === 'object' ? JSON.stringify(details, null, 2) : details}`);
  results.push({ test, status, details });
}

function signPayload(body) {
  return crypto.createHmac('sha256', CLIENT_SECRET).update(body).digest('base64');
}

async function sendWebhook(event, extraFields = {}) {
  const payload = {
    tracking_id: TRACKING_NUMBER,
    shipper_order_ref_no: 'WEBHOOK-E2E-TEST',
    timestamp: new Date().toISOString(),
    event: event,
    status: event,
    is_parcel_on_rts_leg: false,
    ...extraFields,
  };
  const body = JSON.stringify(payload);
  const signature = signPayload(body);

  await axios.post(WEBHOOK_URL, body, {
    headers: {
      'Content-Type': 'application/json',
      'X-Ninjavan-Hmac-Sha256': signature,
    },
  });

  // Wait for async processing to complete
  await new Promise(r => setTimeout(r, 2000));
}

async function getOrder() {
  const { data } = await supabase
    .from('orders')
    .select('id, order_status, payment_status, payment_type, tracking_number, shipped_date, delivered_date, actual_weight, actual_dimensions')
    .eq('id', testOrderId)
    .single();
  return data;
}

async function getWebhookLogs() {
  const { data } = await supabase
    .from('ninjavan_webhook_logs')
    .select('*')
    .eq('tracking_number', TRACKING_NUMBER)
    .order('created_at', { ascending: false })
    .limit(1);
  return data?.[0] || null;
}

async function getStatusHistory() {
  const { data } = await supabase
    .from('order_status_history')
    .select('*')
    .eq('order_id', testOrderId)
    .order('created_at', { ascending: false });
  return data || [];
}

// ============================================================
// Setup: Create test customer + order in Supabase
// ============================================================
async function setup() {
  console.log('\n=== Setup: Create test order in Supabase ===');

  // Create test customer
  const { data: customer, error: custErr } = await supabase
    .from('customers')
    .insert({
      name: 'Webhook E2E Test Customer',
      phone: '+60100000000',
      source_channel: 'other',
    })
    .select()
    .single();

  if (custErr) {
    console.error('Failed to create test customer:', custErr.message);
    process.exit(1);
  }
  testCustomerId = customer.id;
  log('Created test customer', 'INFO', customer.id);

  // Create test order with tracking number
  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .insert({
      order_number: 'WH-E2E-TEST',
      customer_id: customer.id,
      order_status: 'created',
      payment_type: 'cod',
      payment_status: 'cod_pending',
      fulfilment_type: 'ninjavan',
      tracking_number: TRACKING_NUMBER,
      total_amount: 50.00,
      subtotal: 50.00,
      source: 'manual',
    })
    .select()
    .single();

  if (orderErr) {
    console.error('Failed to create test order:', orderErr.message);
    await cleanup();
    process.exit(1);
  }
  testOrderId = order.id;
  log('Created test order', 'INFO', `ID: ${order.id}, Tracking: ${TRACKING_NUMBER}`);

  // Create COD payment record
  const { error: payErr } = await supabase
    .from('order_payments')
    .insert({
      order_id: order.id,
      payment_method: 'cod',
      amount: 50.00,
      status: 'pending',
    });

  if (payErr) {
    log('Created COD payment record', 'FAIL', payErr.message);
  } else {
    log('Created COD payment record', 'INFO', 'amount=50.00, status=pending');
  }
}

// ============================================================
// Test 1: Pending Pickup → order_status = pending_pickup
// ============================================================
async function testPendingPickup() {
  console.log('\n=== Test 1: Pending Pickup ===');
  await sendWebhook('Pending Pickup');

  const order = await getOrder();
  log('order_status = pending_pickup', order?.order_status === 'pending_pickup' ? 'PASS' : 'FAIL', `Got: ${order?.order_status}`);

  const webhookLog = await getWebhookLogs();
  log('Webhook logged to ninjavan_webhook_logs', webhookLog ? 'PASS' : 'FAIL');
  log('Webhook signature_valid = true', webhookLog?.signature_valid === true ? 'PASS' : 'FAIL', `Got: ${webhookLog?.signature_valid}`);
  log('Webhook processing_status = success', webhookLog?.processing_status === 'success' ? 'PASS' : 'FAIL', `Got: ${webhookLog?.processing_status}`);
}

// ============================================================
// Test 2: Picked Up → order_status = in_transit, shipped_date set
// ============================================================
async function testPickedUp() {
  console.log('\n=== Test 2: Picked Up, In Transit to Origin Hub ===');
  await sendWebhook('Picked Up, In Transit to Origin Hub');

  const order = await getOrder();
  log('order_status = in_transit', order?.order_status === 'in_transit' ? 'PASS' : 'FAIL', `Got: ${order?.order_status}`);
  log('shipped_date is set', order?.shipped_date ? 'PASS' : 'FAIL', `Got: ${order?.shipped_date}`);
}

// ============================================================
// Test 3: On Vehicle for Delivery → order_status = out_for_delivery
// ============================================================
async function testOutForDelivery() {
  console.log('\n=== Test 3: On Vehicle for Delivery ===');
  await sendWebhook('On Vehicle for Delivery');

  const order = await getOrder();
  log('order_status = out_for_delivery', order?.order_status === 'out_for_delivery' ? 'PASS' : 'FAIL', `Got: ${order?.order_status}`);
}

// ============================================================
// Test 4: Delivery Exception → status unchanged, note added
// ============================================================
async function testDeliveryException() {
  console.log('\n=== Test 4: Delivery Exception, Pending Reschedule ===');
  const orderBefore = await getOrder();

  await sendWebhook('Delivery Exception, Pending Reschedule', {
    delivery_exception: {
      state: 'Pending Reschedule',
      failure_reason: 'Nobody at Location',
    },
  });

  const orderAfter = await getOrder();
  log('order_status unchanged', orderAfter?.order_status === orderBefore?.order_status ? 'PASS' : 'FAIL',
    `Before: ${orderBefore?.order_status}, After: ${orderAfter?.order_status}`);

  const history = await getStatusHistory();
  const noteEntry = history.find(h => h.notes?.includes('Delivery Exception'));
  log('Note added to order_status_history', noteEntry ? 'PASS' : 'FAIL');
}

// ============================================================
// Test 5: Parcel Measurements Update → actual_weight/dimensions updated
// ============================================================
async function testParcelMeasurements() {
  console.log('\n=== Test 5: Parcel Measurements Update ===');
  await sendWebhook('Parcel Measurements Update', {
    parcel_measurements: {
      weight: 2.3,
      length: 30,
      width: 20,
      height: 15,
    },
  });

  const order = await getOrder();
  log('actual_weight updated', parseFloat(order?.actual_weight) === 2.3 ? 'PASS' : 'FAIL', `Got: ${order?.actual_weight}`);
  log('actual_dimensions updated', order?.actual_dimensions === '30x20x15' ? 'PASS' : 'FAIL', `Got: ${order?.actual_dimensions}`);
}

// ============================================================
// Test 6: Delivered → order_status = delivered, COD payment confirmed
// ============================================================
async function testDelivered() {
  console.log('\n=== Test 6: Delivered, Received by Customer (COD) ===');
  await sendWebhook('Delivered, Received by Customer');

  const order = await getOrder();
  log('order_status = delivered', order?.order_status === 'delivered' ? 'PASS' : 'FAIL', `Got: ${order?.order_status}`);
  log('delivered_date is set', order?.delivered_date ? 'PASS' : 'FAIL', `Got: ${order?.delivered_date}`);
  log('payment_status = cod_collected', order?.payment_status === 'cod_collected' ? 'PASS' : 'FAIL', `Got: ${order?.payment_status}`);

  // Check COD payment record updated
  const { data: payment } = await supabase
    .from('order_payments')
    .select('*')
    .eq('order_id', testOrderId)
    .eq('payment_method', 'cod')
    .single();

  log('COD payment status = confirmed', payment?.status === 'confirmed' ? 'PASS' : 'FAIL', `Got: ${payment?.status}`);
  log('COD payment_date set', payment?.payment_date ? 'PASS' : 'FAIL', `Got: ${payment?.payment_date}`);
}

// ============================================================
// Test 7: Verify full status history chain
// ============================================================
async function testStatusHistory() {
  console.log('\n=== Test 7: Verify order_status_history chain ===');

  const history = await getStatusHistory();
  const webhookEntries = history.filter(h => h.source === 'ninjavan_webhook');

  log(`Total webhook history entries: ${webhookEntries.length}`, webhookEntries.length >= 5 ? 'PASS' : 'FAIL');

  // Check each transition was logged
  const transitions = webhookEntries.map(h => `${h.previous_status} → ${h.new_status}`);
  console.log('       Transitions logged:');
  transitions.forEach(t => console.log(`         ${t}`));
}

// ============================================================
// Test 8: Verify webhook logs table
// ============================================================
async function testWebhookLogs() {
  console.log('\n=== Test 8: Verify ninjavan_webhook_logs ===');

  const { data: logs } = await supabase
    .from('ninjavan_webhook_logs')
    .select('event_name, processing_status, signature_valid')
    .eq('tracking_number', TRACKING_NUMBER)
    .order('created_at', { ascending: true });

  log(`Total webhook logs: ${logs?.length}`, logs?.length >= 6 ? 'PASS' : 'FAIL');

  if (logs) {
    console.log('       Logged events:');
    logs.forEach(l => console.log(`         ${l.event_name} | ${l.processing_status} | sig_valid: ${l.signature_valid}`));

    const allValid = logs.every(l => l.signature_valid === true);
    log('All signatures verified as valid', allValid ? 'PASS' : 'FAIL');

    const allSuccess = logs.filter(l => l.processing_status === 'success').length;
    const allIgnored = logs.filter(l => l.processing_status === 'ignored').length;
    log(`Processing: ${allSuccess} success, ${allIgnored} ignored`, 'INFO');
  }
}

// ============================================================
// Cleanup: Remove test data
// ============================================================
async function cleanup() {
  console.log('\n=== Cleanup ===');

  if (testOrderId) {
    await supabase.from('ninjavan_webhook_logs').delete().eq('tracking_number', TRACKING_NUMBER);
    await supabase.from('order_status_history').delete().eq('order_id', testOrderId);
    await supabase.from('order_payments').delete().eq('order_id', testOrderId);
    await supabase.from('order_line_items').delete().eq('order_id', testOrderId);
    await supabase.from('orders').delete().eq('id', testOrderId);
    log('Cleaned up test order + logs', 'INFO');
  }
  if (testCustomerId) {
    await supabase.from('customers').delete().eq('id', testCustomerId);
    log('Cleaned up test customer', 'INFO');
  }
}

// ============================================================
// Main
// ============================================================
async function main() {
  console.log('==========================================');
  console.log('  NinjaVan Webhook E2E Test');
  console.log('==========================================');
  console.log(`Server: ${SERVER_URL}`);
  console.log(`Test tracking: ${TRACKING_NUMBER}`);

  try {
    await setup();
    await testPendingPickup();
    await testPickedUp();
    await testOutForDelivery();
    await testDeliveryException();
    await testParcelMeasurements();
    await testDelivered();
    await testStatusHistory();
    await testWebhookLogs();
  } catch (err) {
    console.error('\n[ERROR]', err.message);
  } finally {
    await cleanup();
  }

  // Summary
  console.log('\n==========================================');
  console.log('  TEST SUMMARY');
  console.log('==========================================');
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  console.log(`PASS: ${passed} | FAIL: ${failed}`);

  if (failed > 0) {
    console.log('\nFailed tests:');
    results.filter(r => r.status === 'FAIL').forEach(r => console.log(`  - ${r.test}: ${r.details}`));
  }
}

main().catch(console.error);
