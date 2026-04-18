const ninjavanService = require('../services/ninjavan.service');
const supabase = require('../config/database');
const { PDFDocument } = require('pdf-lib');
const { formatSuccessResponse, SuccessMessages } = require('../utils/helpers');
const { NotFoundError, BadRequestError } = require('../utils/errors');

/**
 * Handle NinjaVan webhook - return 200 immediately, process asynchronously
 */
const handleWebhook = async (req, res, next) => {
  // Return 200 immediately to acknowledge receipt
  res.status(200).json({ success: true, message: 'Webhook received' });

  // Process asynchronously
  try {
    const payload = req.body;
    const signature = req.headers['x-ninjavan-hmac-sha256'] || req.headers['x-signature'] || '';
    const rawBody = req.rawBody || JSON.stringify(payload);

    await ninjavanService.processWebhook(payload, signature, rawBody);
  } catch (error) {
    console.error('Webhook processing error:', error.message);
  }
};

/**
 * Generate/download waybill PDF for an order
 */
const generateWaybill = async (req, res, next) => {
  try {
    const orderId = req.params.id;

    // Look up order to get tracking number
    const { data: order, error } = await supabase
      .from('orders')
      .select('id, tracking_number, ninjavan_waybill_url')
      .eq('id', orderId)
      .single();

    if (error || !order) {
      throw new NotFoundError('Order not found');
    }

    if (!order.tracking_number) {
      throw new BadRequestError('Order does not have a NinjaVan tracking number');
    }

    // If waybill already cached, try to return it
    // Otherwise generate fresh
    const pdfBuffer = await ninjavanService.generateWaybill(order.tracking_number);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=waybill-${order.tracking_number}.pdf`);
    res.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
};

/**
 * Cancel a NinjaVan order
 */
const cancelOrder = async (req, res, next) => {
  try {
    const orderId = req.params.id;

    // Look up order
    const { data: order, error } = await supabase
      .from('orders')
      .select('id, tracking_number, order_status')
      .eq('id', orderId)
      .single();

    if (error || !order) {
      throw new NotFoundError('Order not found');
    }

    if (!order.tracking_number) {
      throw new BadRequestError('Order does not have a NinjaVan tracking number');
    }

    // Only allow cancellation for created/pending_pickup status
    const cancellableStatuses = ['created', 'pending_pickup'];
    if (!cancellableStatuses.includes(order.order_status)) {
      throw new BadRequestError(
        `Cannot cancel order in '${order.order_status}' status. Only 'created' or 'pending_pickup' orders can be cancelled.`
      );
    }

    await ninjavanService.cancelOrder(order.tracking_number);

    // Update order status to cancelled
    const previousStatus = order.order_status;
    await supabase
      .from('orders')
      .update({ order_status: 'cancelled' })
      .eq('id', orderId);

    // Log status history
    await supabase
      .from('order_status_history')
      .insert({
        order_id: orderId,
        previous_status: previousStatus,
        new_status: 'cancelled',
        source: 'manual',
        notes: 'NinjaVan order cancelled',
        changed_by: req.user?.id || null,
      });

    res.json(formatSuccessResponse({
      message: 'NinjaVan order cancelled successfully',
      data: { order_id: orderId, tracking_number: order.tracking_number },
    }));
  } catch (error) {
    next(error);
  }
};

/**
 * Retry failed NinjaVan order creation
 */
const retrySync = async (req, res, next) => {
  try {
    const orderId = req.params.id;

    // Fetch order with related data
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        *,
        customer:customers!customer_id(id, name, phone, email),
        shipping_address:customer_addresses!shipping_address_id(*),
        fulfilment_location:storage_locations!fulfilment_location_id(*)
      `)
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      throw new NotFoundError('Order not found');
    }

    if (!order.ninjavan_sync_failed) {
      throw new BadRequestError('Order does not have a failed NinjaVan sync');
    }

    if (order.fulfilment_type !== 'ninjavan') {
      throw new BadRequestError('Order fulfilment type is not NinjaVan');
    }

    const result = await ninjavanService.createOrder(
      order,
      order.customer,
      order.shipping_address,
      order.fulfilment_location
    );

    res.json(formatSuccessResponse({
      message: 'NinjaVan order sync retried successfully',
      data: result,
    }));
  } catch (error) {
    next(error);
  }
};

/**
 * Mark a single order's AWB as printed and return the waybill PDF
 */
const printWaybill = async (req, res, next) => {
  try {
    const orderId = req.params.id;

    const { data: order, error } = await supabase
      .from('orders')
      .select('id, tracking_number')
      .eq('id', orderId)
      .single();

    if (error || !order) throw new NotFoundError('Order not found');
    if (!order.tracking_number) throw new BadRequestError('Order does not have a tracking number');

    const pdfBuffer = await ninjavanService.generateWaybill(order.tracking_number);

    // Mark as printed (if column exists)
    const hasAwbCol = await checkAwbColumn();
    if (hasAwbCol) {
      await supabase.from('orders')
        .update({ awb_printed_at: new Date().toISOString() })
        .eq('id', orderId)
        .is('awb_printed_at', null);
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename=waybill-${order.tracking_number}.pdf`);
    res.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
};

/**
 * List NinjaVan pending_pickup orders that have NOT been printed yet
 */
const listPrintableOrders = async (req, res, next) => {
  try {
    const hasAwbCol = await checkAwbColumn();

    let query;

    if (hasAwbCol) {
      query = supabase
        .from('orders')
        .select('id, order_number, tracking_number, order_date, total_amount, payment_type, awb_printed_at, customer:customers!customer_id(id, name, phone)')
        .eq('fulfilment_type', 'ninjavan')
        .eq('order_status', 'pending_pickup')
        .not('tracking_number', 'is', null)
        .is('awb_printed_at', null)
        .order('created_at', { ascending: true });
    } else {
      query = supabase
        .from('orders')
        .select('id, order_number, tracking_number, order_date, total_amount, payment_type, customer:customers!customer_id(id, name, phone)')
        .eq('fulfilment_type', 'ninjavan')
        .eq('order_status', 'pending_pickup')
        .not('tracking_number', 'is', null)
        .order('created_at', { ascending: true });
    }

    const { data: orders, error } = await query;
    if (error) throw new BadRequestError(`Failed: ${error.message}`);

    res.json(formatSuccessResponse({
      message: SuccessMessages.FETCHED,
      data: orders || [],
    }));
  } catch (error) {
    next(error);
  }
};

/**
 * Check if awb_printed_at column exists, cache the result
 */
let _awbColumnExists = null;
const checkAwbColumn = async () => {
  if (_awbColumnExists !== null) return _awbColumnExists;
  const { error } = await supabase.from('orders').select('awb_printed_at').limit(1);
  _awbColumnExists = !error;
  return _awbColumnExists;
};

/**
 * Bulk print AWBs for selected order IDs.
 * Expects { order_ids: [uuid, ...] } in the request body.
 */
const bulkPrintWaybills = async (req, res, next) => {
  try {
    const { order_ids } = req.body;

    if (!order_ids || !Array.isArray(order_ids) || order_ids.length === 0) {
      throw new BadRequestError('order_ids is required and must be a non-empty array');
    }

    const hasAwbCol = await checkAwbColumn();

    // Fetch the selected orders (verify they're valid NinjaVan orders with tracking)
    const { data: orders, error } = await supabase
      .from('orders')
      .select('id, tracking_number, order_number')
      .in('id', order_ids)
      .eq('fulfilment_type', 'ninjavan')
      .not('tracking_number', 'is', null);

    if (error) throw new BadRequestError(`Failed: ${error.message}`);
    if (!orders || orders.length === 0) {
      throw new BadRequestError('No valid NinjaVan orders found for the selected IDs');
    }

    // Generate waybills for each order and collect buffers
    const pdfBuffers = [];
    const printedIds = [];

    for (const order of orders) {
      try {
        const buf = await ninjavanService.generateWaybill(order.tracking_number);
        pdfBuffers.push(buf);
        printedIds.push(order.id);
      } catch (err) {
        console.error(`Waybill failed for ${order.order_number}:`, err.message);
      }
    }

    if (pdfBuffers.length === 0) {
      throw new BadRequestError('Failed to generate any waybills');
    }

    // Mark all as printed (if column exists)
    if (hasAwbCol) {
      const now = new Date().toISOString();
      await supabase.from('orders')
        .update({ awb_printed_at: now })
        .in('id', printedIds);
    }

    // Merge all PDFs into one multi-page document using pdf-lib
    const mergedPdf = await PDFDocument.create();
    for (const buf of pdfBuffers) {
      try {
        const srcDoc = await PDFDocument.load(buf);
        const pages = await mergedPdf.copyPages(srcDoc, srcDoc.getPageIndices());
        pages.forEach((page) => mergedPdf.addPage(page));
      } catch (err) {
        console.error('Failed to merge a PDF page:', err.message);
      }
    }
    const combined = Buffer.from(await mergedPdf.save());

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename=bulk-awb-${printedIds.length}-orders.pdf`);
    res.setHeader('X-AWB-Count', printedIds.length);
    res.send(combined);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  handleWebhook,
  generateWaybill,
  printWaybill,
  listPrintableOrders,
  bulkPrintWaybills,
  cancelOrder,
  retrySync,
};
